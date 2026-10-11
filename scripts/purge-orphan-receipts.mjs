#!/usr/bin/env node
/**
 * scripts/purge-orphan-receipts.mjs
 *
 * Scans the 'receipts' Storage bucket and deletes objects that have no
 * corresponding row in public.transactions.
 *
 * Runs weekly at the end of .github/workflows/backup.yml.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/purge-orphan-receipts.mjs [--dry-run]
 */

import { createClient } from '@supabase/supabase-js';

// Import pure logic from orphans.ts (with fallback if running in a Node environment without TS stripping)
let findOrphanReceipts;
let chunk;

try {
  const orphansModule = await import('../src/lib/receipts/orphans.ts');
  findOrphanReceipts = orphansModule.findOrphanReceipts;
  chunk = orphansModule.chunk;
} catch {
  // Pure fallback identical to src/lib/receipts/orphans.ts
  findOrphanReceipts = (storagePaths, livePhotoPaths, options) => {
    if (options?.dbError != null && options.dbError !== false) return [];
    if (livePhotoPaths == null) return [];
    const liveSet = livePhotoPaths instanceof Set ? livePhotoPaths : new Set(livePhotoPaths);
    return storagePaths.filter((path) => Boolean(path) && !liveSet.has(path));
  };
  chunk = (items, size = 100) => {
    if (size <= 0) return [items];
    const chunks = [];
    for (let i = 0; i < items.length; i += size) {
      chunks.push(items.slice(i, i + size));
    }
    return chunks;
  };
}

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error('Error: Missing required environment variables SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const isDryRun = process.argv.includes('--dry-run');

const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function listAllReceiptObjects() {
  const allFiles = [];
  async function walk(folder) {
    let offset = 0;
    const limit = 100;
    while (true) {
      const { data, error } = await supabase.storage.from('receipts').list(folder, {
        limit,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      });
      if (error) {
        throw new Error(`Failed to list objects in receipts bucket (${folder || 'root'}): ${error.message}`);
      }
      if (!data || data.length === 0) break;

      for (const item of data) {
        const itemPath = folder ? `${folder}/${item.name}` : item.name;
        // Supabase folders have no id/metadata or directory mimetype
        if (!item.id && !item.metadata) {
          await walk(itemPath);
        } else if (item.metadata?.mimetype === 'application/x-directory') {
          await walk(itemPath);
        } else {
          allFiles.push(itemPath);
        }
      }

      if (data.length < limit) break;
      offset += limit;
    }
  }
  await walk('');
  return allFiles;
}

async function main() {
  // 1. Look up live transactions.photo_path values, page by page: a single select
  //    stops at the API row limit (1000), and a short list would delete live receipts.
  const txs = [];
  for (let from = 0; ; from += 1000) {
    const { data, error: txError } = await supabase
      .from('transactions')
      .select('photo_path')
      .not('photo_path', 'is', null)
      .order('id')
      .range(from, from + 999);
    if (txError) {
      console.error(`Error: Failed to query transactions table: ${txError.message}`);
      // Never delete anything when the DB query fails
      process.exit(1);
    }
    txs.push(...data);
    if (data.length < 1000) break;
  }

  const livePhotoPaths = (txs || []).map((t) => t.photo_path).filter(Boolean);

  // 2. List all storage objects in the receipts bucket
  let allObjects = [];
  try {
    allObjects = await listAllReceiptObjects();
  } catch (err) {
    console.error(`Error: Failed to list objects in receipts bucket: ${err.message}`);
    process.exit(1);
  }

  // 3. Find orphan storage objects
  const orphans = findOrphanReceipts(allObjects, livePhotoPaths);

  // 4. Delete orphans in batches of 100
  let removedCount = 0;
  if (orphans.length > 0) {
    const batches = chunk(orphans, 100);
    for (const batch of batches) {
      if (isDryRun) {
        for (const file of batch) {
          console.log(`[dry-run] Would delete: ${file}`);
        }
        removedCount += batch.length;
      } else {
        const { error: removeError } = await supabase.storage.from('receipts').remove(batch);
        if (removeError) {
          console.error(`Error: Failed to delete storage objects batch: ${removeError.message}`);
          process.exit(1);
        }
        removedCount += batch.length;
      }
    }
  }

  console.log(`checked ${allObjects.length}, removed ${removedCount}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(`Fatal error: ${err.message}`);
  process.exit(1);
});
