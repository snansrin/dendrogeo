import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawReportMapHeading } from '../scripts/lib/report-map-heading.mjs';

test('report map heading retains title, subtitles, report ID text and positions', () => {
  const calls = [];
  drawReportMapHeading({
    text: (...args) => calls.push(args), width: 220, padding: 26,
    parkName: 'Kuğulu Parkı', sub: 'Yüzey özeti', sub2: '2026 · 10 m',
    meta: { id: 'DGR-2026-0042' }, ink: [24, 36, 32], muted: [104, 118, 110]
  });

  assert.deepEqual(calls, [
    [26, 12, 'Kuğulu Parkı', [24, 36, 32], 3],
    [26, 44, 'Yüzey özeti', [104, 118, 110], 2],
    [26, 66, '2026 · 10 m', [104, 118, 110], 2],
    [38, 12, 'DGR-2026-0042', [104, 118, 110], 2]
  ]);
});

test('report map heading omits absent secondary and report identity lines', () => {
  const calls = [];
  drawReportMapHeading({
    text: (...args) => calls.push(args), width: 180, padding: 26,
    parkName: 'Test', sub: 'Alt', sub2: '', meta: { id: '' },
    ink: 'ink', muted: 'muted'
  });

  assert.deepEqual(calls, [[26, 12, 'Test', 'ink', 3], [26, 44, 'Alt', 'muted', 2]]);
});
