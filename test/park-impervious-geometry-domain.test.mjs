import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { loadApp } from '../scripts/test-harness.mjs';

const source = readFileSync(new URL('../src/domain/parks/impervious-geometry.js', import.meta.url), 'utf8');
const context = vm.createContext({ window: {} });
vm.runInContext(source, context);
const domain = context.window.DG_PARK_IMPERVIOUS_GEOMETRY;
const helpers = { extractRings: () => null, roadHalfWidth: () => 3 };

test('closed hard-surface areas become rings and unclassified closed ways are ignored', () => {
  const sinks = { rings: [], lines: [], blockLines: [] };
  const geometry = [
    { lat: 39, lon: 32 }, { lat: 39, lon: 32.001 },
    { lat: 39.001, lon: 32.001 }, { lat: 39, lon: 32 }
  ];
  domain.collectImperviousGeometry({ type: 'way', tags: { amenity: 'parking' }, geometry }, sinks, helpers);
  domain.collectImperviousGeometry({ type: 'way', tags: { surface: 'grass' }, geometry }, sinks, helpers);
  assert.equal(sinks.rings.length, 1);
  assert.equal(sinks.lines.length, 0);
  assert.equal(sinks.blockLines.length, 0);
  assert.equal(domain.isClosedLine([[1, 2], [2, 3], [1, 2]]), true);
  assert.equal(domain.isClosedLine([[1, 2], [2, 3]]), false);
});

test('open road geometry retains parsed half-width and grid-block rules', () => {
  const sinks = { rings: [], lines: [], blockLines: [] };
  const geometry = [{ lat: 39, lon: 32 }, { lat: 39.001, lon: 32.001 }];
  domain.collectImperviousGeometry({ type: 'way', tags: { highway: 'residential', width: '6,4' }, geometry }, sinks, helpers);
  domain.collectImperviousGeometry({ type: 'way', tags: { highway: 'footway' }, geometry }, sinks, helpers);
  assert.equal(sinks.lines.length, 2);
  assert.equal(sinks.lines[0].w, 3.2);
  assert.equal(sinks.lines[1].w, 3);
  assert.equal(sinks.blockLines.length, 1);
  assert.equal(sinks.blockLines[0].w, 3.2);

  domain.collectPedestrianGridBlocker({ type: 'way', tags: { highway: 'footway', width: '2,4' }, geometry }, sinks, helpers);
  assert.equal(sinks.blockLines.length, 2);
  assert.equal(sinks.blockLines[1].w, 1.2);
});

test('legacy park geometry service wrappers write into the existing state arrays', () => {
  const app = loadApp();
  const result = vm.runInContext(`(() => {
    IMP_RINGS=[]; IMP_LINES=[]; GRID_BLOCK_LINES=[];
    collectImperviousGeometry({type:'way',tags:{highway:'primary',width:'8'},geometry:[{lat:39,lon:32},{lat:39.001,lon:32.001}]});
    collectPedestrianGridBlocker({type:'way',tags:{highway:'path',width:'2'},geometry:[{lat:39,lon:32},{lat:39.001,lon:32.001}]});
    return {lines:IMP_LINES,blocks:GRID_BLOCK_LINES};
  })()`, app);
  assert.equal(result.lines.length, 1);
  assert.equal(result.lines[0].w, 4);
  assert.equal(result.blocks.length, 2);
  assert.equal(result.blocks[0].w, 4);
  assert.equal(result.blocks[1].w, 1);
});
