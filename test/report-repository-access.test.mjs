import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createReportRepositoryAccess } from '../scripts/lib/report-repository-access.mjs';

test('report repository access resolves from the entry point and reads UTF-8 paths', () => {
  const moduleUrl = new URL('../scripts/make-report.mjs', import.meta.url).href;
  const calls = [];
  const access = createReportRepositoryAccess(moduleUrl, (path, encoding) => {
    calls.push([path, encoding]);
    return 'CNAME contents';
  });

  const expectedRoot = join(dirname(fileURLToPath(moduleUrl)), '..');
  assert.equal(access.root, expectedRoot);
  assert.equal(access.read('CNAME'), 'CNAME contents');
  assert.deepEqual(calls, [[join(expectedRoot, 'CNAME'), 'utf8']]);
});
