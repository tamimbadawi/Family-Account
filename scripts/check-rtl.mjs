import fs from 'node:fs';
import path from 'node:path';

const rx = /(^|["'` :])-?(ml|mr|pl|pr|left|right)-[0-9a-z\[]|(^|["'` :])(text-(left|right)|rounded-(l|r|tl|tr|bl|br)|border-(l|r))([-"'` ]|$)/;

let failures = 0;

function scan(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scan(full);
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      const lines = fs.readFileSync(full, 'utf8').split('\n');
      lines.forEach((line, idx) => {
        if (rx.test(line)) {
          console.error(`RTL violation at ${full}:${idx + 1}\n  ${line.trim()}`);
          failures++;
        }
      });
    }
  }
}

scan('src');

if (failures > 0) {
  console.error(`Total violations: ${failures}`);
  process.exit(1);
} else {
  console.log('Zero RTL violations found.');
}
