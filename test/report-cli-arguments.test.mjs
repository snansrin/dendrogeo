import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createReportCliArguments } from '../scripts/lib/report-cli-arguments.mjs';

test('report CLI arguments preserve existing exact flag and first-value behavior', () => {
  const cli = createReportCliArguments([
    'node', 'scripts/make-report.mjs',
    '--park', '7',
    '--skip-lulc=yes',
    '--reindex',
    '--park', '8',
    '--publication-file',
  ]);

  assert.equal(cli.arg('park'), '7');
  assert.equal(cli.arg('missing'), null);
  assert.equal(cli.arg('publication-file'), undefined);
  assert.equal(cli.has('skip-lulc'), false);
  assert.equal(cli.has('skip-lulc=yes'), true);
  assert.equal(cli.has('reindex'), true);
});
