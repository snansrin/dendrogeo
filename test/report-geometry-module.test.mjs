import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  pointInRing,
  pointInPolygon,
  ringSelfIntersections,
  geometrySelfIntersections,
  bboxRing,
  ringGeodesicAreaM2,
} from '../scripts/lib/report-geometry.mjs';
import { pointInPolygon as legacyPointInPolygon } from '../scripts/make-report.mjs';

test('report point-in-polygon keeps [lat, lon] ring order and hole exclusion', () => {
  const outer = [[39, 32], [39, 33], [40, 33], [40, 32], [39, 32]];
  const hole = [[39.3, 32.3], [39.3, 32.7], [39.7, 32.7], [39.7, 32.3], [39.3, 32.3]];
  assert.equal(pointInRing(39.5, 32.1, outer), true);
  assert.equal(pointInPolygon(39.5, 32.1, outer), true);
  assert.equal(pointInPolygon(39.5, 32.5, outer, [hole]), false);
  assert.equal(pointInPolygon(41, 32.5, outer), false);
  assert.equal(pointInPolygon(39.5, 32.1, outer), legacyPointInPolygon(39.5, 32.1, outer));
});

test('self-intersection counts include polygon holes and preserve the report QA semantics', () => {
  const clean = [[0, 0], [0, 2], [2, 2], [2, 0], [0, 0]];
  const bowtie = [[0, 0], [0, 2], [2, 0], [2, 2], [0, 0]];
  assert.equal(ringSelfIntersections(clean), 0);
  assert.equal(ringSelfIntersections(bowtie), 1);
  assert.equal(geometrySelfIntersections(clean, [bowtie]), 1);
  assert.equal(ringSelfIntersections([[0, 0], [1, 1], [0, 0]]), 0);
});

test('bbox and area helpers retain their accepted park-geometry behavior', () => {
  const rect = [[39.99, 32.65], [39.99, 32.66], [39.98, 32.66], [39.98, 32.65], [39.99, 32.65]];
  const lShape = [[0, 0], [0, 2], [1, 2], [1, 1], [2, 1], [2, 0], [0, 0]];
  assert.equal(bboxRing(rect), true);
  assert.equal(bboxRing(lShape), false);
  assert.equal(ringGeodesicAreaM2(null), 0);
  const area = ringGeodesicAreaM2(rect);
  assert.ok(area > 900000 && area < 1100000, `unexpected area: ${area}`);
});
