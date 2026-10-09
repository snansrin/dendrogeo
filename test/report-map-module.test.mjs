import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as moduleMap from '../scripts/lib/report-map.mjs';
import * as reportApi from '../scripts/make-report.mjs';

test('report map APIs remain identical and render PNG bytes through make-report', () => {
  for (const name of ['MAP_TONES', 'mapCanvas', 'renderMapPNG'])
    assert.strictEqual(reportApi[name], moduleMap[name], `${name} API identity`);
  const outer = [[0, 0], [0, 0.01], [0.01, 0.01], [0.01, 0], [0, 0]];
  const image = moduleMap.renderMapPNG({ outer, classes: {}, parkName: 'TEST' });
  assert.deepEqual(Array.from(image.subarray(0, 8)), [137, 80, 78, 71, 13, 10, 26, 10]);
});
