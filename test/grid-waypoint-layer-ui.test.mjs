import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const context = vm.createContext({ window: {} });
vm.runInContext(readFileSync(new URL('../src/ui/grid-waypoint-layer.js', import.meta.url), 'utf8'), context);
const render = context.window.DG_GRID_WAYPOINT_LAYER.render;

test('replaces the old waypoint layer and draws a marker for every saved row', () => {
  const calls = [];
  const map = { removeLayer: layer => calls.push(['remove', layer]) };
  const layer = { addTo: target => { calls.push(['layer-add', target]); return layer; } };
  const leaflet = {
    layerGroup: () => layer,
    circleMarker: (point, style) => ({ addTo: target => { calls.push(['marker', point, style, target]); } })
  };
  const previousLayer = {};
  const rows = [{ lat: 40.1, lon: 32.2 }, { lat: 40.3, lon: 32.4 }];
  assert.equal(render({ map, previousLayer, rows, leaflet }), layer);
  assert.deepEqual(calls.map(call => call[0]), ['remove', 'layer-add', 'marker', 'marker']);
  assert.equal(calls[0][1], previousLayer);
  assert.equal(calls[1][1], map);
  assert.deepEqual(JSON.parse(JSON.stringify(calls[2][1])), [40.1, 32.2]);
  assert.deepEqual(JSON.parse(JSON.stringify(calls[3][1])), [40.3, 32.4]);
  assert.deepEqual(JSON.parse(JSON.stringify(calls[2][2])), { radius: 5, color: '#fff', weight: 1.5, fillColor: '#e11d48', fillOpacity: 0.95, interactive: false });
  assert.equal(calls[2][3], layer);
});

test('first waypoint layer does not remove a missing previous layer', () => {
  let removed = false;
  const map = { removeLayer: () => { removed = true; } };
  const layer = { addTo: () => layer };
  const leaflet = { layerGroup: () => layer, circleMarker: () => ({ addTo() {} }) };
  render({ map, previousLayer: null, rows: [], leaflet });
  assert.equal(removed, false);
});
