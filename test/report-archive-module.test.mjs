import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DGR_ID_RE, nextReportId, parkHistory, readReportIndex, readRetractedReportIndex, rebuildIndex } from '../scripts/lib/report-archive.mjs';
import { parkHistory as legacyParkHistory, rebuildIndex as legacyRebuildIndex } from '../scripts/make-report.mjs';

test('archive keeps report ID validation and chooses the next year sequence', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dg-report-archive-'));
  assert.equal(DGR_ID_RE.test('DGR-2026-0024'), true);
  assert.equal(DGR_ID_RE.test('DGR-2026-24'), false);
  mkdirSync(join(dir, 'DGR-2026-0002'));
  mkdirSync(join(dir, 'DGR-2026-0011'));
  mkdirSync(join(dir, 'DGR-2025-0099'));
  assert.equal(nextReportId(dir, 2026), 'DGR-2026-0012');
  assert.equal(nextReportId(dir, 2027), 'DGR-2027-0001');
});

test('archive park history filters retired, self, and other parks while preserving retraction notes', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dg-report-history-'));
  writeFileSync(join(dir, 'yayin-kuyrugu.json'), JSON.stringify({
    retired_report_ids: ['DGR-2026-0001'],
    entries: [
      { report_id: 'DGR-2026-0001', park_id: 7, status: 'Yayınlandı' },
      { report_id: 'DGR-2026-0002', park_id: 7, status: 'Yayınlandı', finished_at: '2026-10-02T12:00:00Z' },
      { report_id: 'DGR-2026-0002', park_id: 7, status: 'Geri çekildi' },
      { report_id: 'DGR-2026-0003', park_id: 8, status: 'Yayınlandı' },
      { report_id: 'DGR-2026-0004', park_id: 7, status: 'Yayınlandı' },
      { report_id: 'DGR-2026-0005', park_id: 7, status: 'Beklemede' },
    ],
  }));

  assert.deepEqual(parkHistory(dir, 7, 'DGR-2026-0004'), [{
    id: 'DGR-2026-0002',
    date: '2026-10-02',
    retracted: true,
    note: 'Aynı parkın önceki analizi (geri çekildi)',
  }]);
  assert.deepEqual(parkHistory(dir, 7, 'DGR-2026-0004'), legacyParkHistory(dir, 7, 'DGR-2026-0004'));
});

test('archive reindex ignores missing, malformed and non-DGR snapshots and escapes park names', () => {
  const parent = mkdtempSync(join(tmpdir(), 'dg-report-index-'));
  assert.deepEqual(rebuildIndex(join(parent, 'missing')), []);
  const dir = join(parent, 'reports');
  mkdirSync(join(dir, 'DGR-2026-0001'), { recursive: true });
  mkdirSync(join(dir, 'DGR-2026-0002'), { recursive: true });
  mkdirSync(join(dir, 'DGR-2026-0003'), { recursive: true });
  mkdirSync(join(dir, 'not-a-report'), { recursive: true });
  writeFileSync(join(dir, 'DGR-2026-0001', 'data.json'), JSON.stringify({
    park: { name: '<script>Park</script>' },
    totals: { n: 2, ci: { mean: 24000, lo: 13000, hi: 35000 } },
    generated_at: '2026-09-27T10:00:00Z',
  }));
  writeFileSync(join(dir, 'DGR-2026-0002', 'data.json'), '{broken');
  writeFileSync(join(dir, 'DGR-2026-0003', 'index.html'), '<html>withdrawn</html>');
  writeFileSync(join(dir, 'not-a-report', 'data.json'), '{}');

  const list = rebuildIndex(dir);
  assert.deepEqual(list, [{ id: 'DGR-2026-0001', park: '<script>Park</script>', n: 2, carbon: '24,00 t [13,00–35,00]', date: '2026-09-27' }]);
  assert.equal(readFileSync(join(dir, 'index.html'), 'utf8').includes('&lt;script&gt;Park&lt;/script&gt;'), true);
  assert.equal(readFileSync(join(dir, 'index.html'), 'utf8').includes('DGR-2026-0003/'), false);
});

test('public report index lists withdrawn DGR and validated DOI without exposing retraction details', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dg-report-retracted-index-'));
  mkdirSync(join(dir, 'DGR-2026-0023'), { recursive: true });
  writeFileSync(join(dir, 'DGR-2026-0023', 'data.json'), JSON.stringify({
    park: { name: 'Park' }, totals: { n: 1, ci: { mean: 10, lo: 8, hi: 12 } }, generated_at: '2026-10-01T00:00:00Z',
  }));
  writeFileSync(join(dir, 'yayin-kuyrugu.json'), JSON.stringify({ entries: [
    { report_id: 'DGR-2026-0023', status: 'Yayınlandı', doi: '10.5281/zenodo.23196877' },
    { report_id: 'DGR-2026-0023', status: 'Geri çekildi', finished_at: '2026-10-14T09:48:11.279Z', reason: '<private>', requested_by: 'private-user' },
    { report_id: 'DGR-2026-0024', status: 'Geri çekildi', finished_at: 'bad-date', doi: 'javascript:alert(1)' },
  ] }));

  assert.deepEqual(readRetractedReportIndex(dir), [
    { id: 'DGR-2026-0023', doi: '10.5281/zenodo.23196877', date: '2026-10-14' },
    { id: 'DGR-2026-0024', doi: '', date: '' },
  ]);
  assert.deepEqual(readReportIndex(dir), []);
  rebuildIndex(dir);
  const html = readFileSync(join(dir, 'index.html'), 'utf8');
  assert.match(html, /DGR-2026-0023/);
  assert.match(html, /https:\/\/doi\.org\/10\.5281\/zenodo\.23196877/);
  assert.match(html, /Geri çekildi/);
  assert.doesNotMatch(html, /<private>|private-user|javascript:/);
  assert.doesNotMatch(html, /gorunum\/\?id=DGR-2026-0023/);
});
