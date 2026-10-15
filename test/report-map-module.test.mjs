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

test('published PNG rasterizes geometry at triple resolution without changing source data', () => {
  const outer=[[0,0],[0,.01],[.01,.01],[.01,0],[0,0]];
  const opts={outer,classes:{},parkName:'TEST'};
  const before=JSON.stringify(opts),logical=moduleMap.mapCanvas(opts);
  const png=moduleMap.renderMapPNG(opts);
  assert.equal(png.readUInt32BE(16),logical.w*3);
  assert.equal(png.readUInt32BE(20),logical.h*3);
  assert.equal(JSON.stringify(opts),before);
  const standard=moduleMap.renderMapPNG({...opts,pixelRatio:1});
  assert.equal(standard.readUInt32BE(16),logical.w);
});
