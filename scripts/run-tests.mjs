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
const result = spawnSync(process.execPath, ['--test', ...files], { cwd: root, stdio: 'inherit' });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
