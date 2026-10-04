#!/usr/bin/env node
// Read-only: validates the recovery objects, never resets files or changes refs.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const manifest = JSON.parse(readFileSync(new URL('../docs/recovery-core-2026-10-04.json', import.meta.url)));
const git = (...args) => execFileSync('git', args, { cwd: root, maxBuffer: 32 * 1024 * 1024 });
try {
  const tree = git('rev-parse', `${manifest.commit}^{tree}`).toString().trim();
  if (tree !== manifest.tree) throw new Error('Kurtarma ağacı manifest ile eşleşmiyor.');
  for (const [path, expected] of Object.entries(manifest.files)) {
    const hash = createHash('sha256').update(git('show', `${manifest.commit}:${path}`)).digest('hex');
    if (hash !== expected) throw new Error(`Kurtarma dosyası eşleşmiyor: ${path}`);
  }
  console.log(`Kurtarma doğrulandı: ${manifest.commit}; ${Object.keys(manifest.files).length} çalışma dosyası.`);
} catch (error) {
  console.error(error.message);
  console.error(`Eksik Git nesneleri için: git fetch origin ${manifest.branch}`);
  process.exitCode = 1;
}
