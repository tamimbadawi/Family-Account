import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Permanent guard:
 * Screens must open instantly from the copy on the phone, never wait on the server.
 * Scan src/app/[locale]/(app), src/components, and src/lib/auth (skip *.test.*).
 * Fail if any file contains getSupabaseBrowserClient or imports family-admin,
 * unless it is in an explicit allow-list with a reason.
 */

interface AllowedFile {
  relativePath: string;
  reason: string;
}

const ALLOW_LIST: AllowedFile[] = [
  {
    relativePath: 'src/app/[locale]/(app)/settings/page.tsx',
    reason: 'Calls signOut() on tap when the user signs out',
  },
  {
    relativePath: 'src/app/[locale]/(app)/settings/family/page.tsx',
    reason: 'Calls familyAdmin() on tap for admin actions (reset password, remove, make admin)',
  },
  {
    relativePath: 'src/lib/auth/family-name.ts',
    reason: 'Calls households.update on tap when renaming the family',
  },
  {
    relativePath: 'src/lib/auth/family-admin.ts',
    reason: 'Client helper for invoking the family-admin Edge Function',
  },
  {
    relativePath: 'src/lib/auth/family-invites.ts',
    reason: 'Client helper for family invites outside open screens',
  },
  {
    relativePath: 'src/lib/auth/operator.ts',
    reason: 'Client helper for operator functionality outside family screens',
  },
  {
    relativePath: 'src/lib/auth/after-sign-in.ts',
    reason: 'Post-authentication helper executed after sign-in',
  },
  {
    relativePath: 'src/lib/auth/sign-up.ts',
    reason: 'Sign-up helper used during authentication',
  },
];

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/');
}

function getAllFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllFiles(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

describe('no server on open guard', () => {
  it('ensures no app screen or component makes server calls on open', () => {
    const root = path.resolve(__dirname, '../../..');
    const scanDirs = [
      path.join(root, 'src/app/[locale]/(app)'),
      path.join(root, 'src/components'),
      path.join(root, 'src/lib/auth'),
    ];

    const allowedMap = new Map(
      ALLOW_LIST.map((item) => [normalizePath(item.relativePath), item.reason])
    );

    const violations: { file: string; match: string }[] = [];

    for (const scanDir of scanDirs) {
      if (!fs.existsSync(scanDir)) continue;
      const files = getAllFiles(scanDir);
      for (const file of files) {
        const norm = normalizePath(path.relative(root, file));
        if (norm.includes('.test.')) continue;

        if (allowedMap.has(norm)) {
          continue;
        }

        const content = fs.readFileSync(file, 'utf-8');
        const hasBrowserClient = content.includes('getSupabaseBrowserClient');
        const importsFamilyAdmin =
          /from\s+['"][^'"]*family-admin['"]/.test(content) ||
          /import\s+['"][^'"]*family-admin['"]/.test(content);

        if (hasBrowserClient) {
          violations.push({
            file: norm,
            match: 'contains getSupabaseBrowserClient',
          });
        }
        if (importsFamilyAdmin) {
          violations.push({
            file: norm,
            match: 'imports family-admin',
          });
        }
      }
    }

    if (violations.length > 0) {
      const details = violations
        .map((v) => `  - ${v.file}: ${v.match}`)
        .join('\n');
      expect.fail(
        `Server calls detected in screens or components on open:\n${details}\n\n` +
          'Screens must open instantly from the copy on the phone, never wait on the server. ' +
          'Read from the repository hooks in src/lib/data/provider instead.'
      );
    }
  });
});
