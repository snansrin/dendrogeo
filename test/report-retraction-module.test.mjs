import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRetractionNotice } from '../scripts/lib/report-retraction.mjs';
import { renderRetractionNotice } from '../scripts/make-report.mjs';

test('retraction module produces escaped, noindex notices and make-report keeps its API', () => {
  assert.equal(typeof renderRetractionNotice, 'function');
  const render = createRetractionNotice({ siteOrigin: 'https://reports.example', reportTitle: 'DGR test title' });
  const html = render({
    id: 'DGR-2026-0009',
    parkName: '<script>Park</script>',
    reason: '<img src=x onerror=alert(1)>',
    retractedAt: '2026-09-28T10:00:00Z',
  });
  assert.match(html, /<meta name="robots" content="noindex, follow">/);
  assert.match(html, /href="https:\/\/reports\.example\/rapor\/DGR-2026-0009\/"/);
  assert.match(html, /&lt;script&gt;Park&lt;\/script&gt;/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html, /28 Eylül 2026/);
  assert.match(html, /DGR test title/);
});
