import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveReportSiteOrigin } from '../scripts/lib/report-site-origin.mjs';

test('report site origin trims the repository CNAME and keeps HTTPS', () => {
  const calls = [];
  const origin = resolveReportSiteOrigin(path => {
    calls.push(path);
    return '  reports.example.org\n';
  });

  assert.equal(origin, 'https://reports.example.org');
  assert.deepEqual(calls, ['CNAME']);
});

test('report site origin falls back for an empty or unavailable CNAME', () => {
  assert.equal(resolveReportSiteOrigin(() => '  \n'), 'https://dendrogeo.org');
  assert.equal(resolveReportSiteOrigin(() => { throw new Error('missing CNAME'); }), 'https://dendrogeo.org');
});
