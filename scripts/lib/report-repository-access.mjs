import {readFileSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

/* Bind report-relative reads to the repository root at the report entry point. */
export function createReportRepositoryAccess(moduleUrl, readText = readFileSync) {
  const root = join(dirname(fileURLToPath(moduleUrl)), '..');
  const read = path => readText(join(root, path), 'utf8');
  return {root, read};
}
