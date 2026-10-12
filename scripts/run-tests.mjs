#!/usr/bin/env node
// Enumerate explicitly: directory arguments differ across Node versions and
// shell globs do not expand in Windows cmd.exe (the project supports Node 20+).
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
const root = fileURLToPath(new URL('..', import.meta.url));
const files = readdirSync(join(root, 'test'))
  .filter(name => name.endsWith('.test.mjs')).sort()
  .map(name => join(root, 'test', name));
if (!files.length) throw new Error('No test files found');
// Keep the Windows process command line below its length limit on large suites.
const batchSize = 30;
let failed = false;
for (let start = 0; start < files.length; start += batchSize) {
  const batch = files.slice(start, start + batchSize);
  const result = spawnSync(process.execPath, ['--test', ...batch], { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) failed = true;
}
process.exit(failed ? 1 : 0);
