import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const context = vm.createContext({ window: {} });
vm.runInContext(readFileSync(new URL('../src/ui/grid-summary.js', import.meta.url), 'utf8'), context);
const render = context.window.DG_GRID_SUMMARY.render;
const format = (template, values) => template.replace(/\{(\w+)\}/g, (_, key) => values[key]);

test('grid summary keeps percentages, action visibility, translations, and metadata', () => {
  const element = { style: {}, innerHTML: '' };
  render({
    element, size: 10, total: 3, measured: 1, empty: 2, selected: 1, meta: '<p>meta</p>',
    translate: value => `tr:${value}`, translateFormat: format
  });
  assert.equal(element.style.display, 'block');
  assert.match(element.innerHTML, /10×10 m/);
  assert.match(element.innerHTML, /tr:Ölçülmüş:<\/span>|tr:Ölçülmüş:/);
  assert.match(element.innerHTML, /%33/);
  assert.match(element.innerHTML, /%67/);
  assert.match(element.innerHTML, /createWaypointsFromGrid\('auto'\)/);
  assert.match(element.innerHTML, /createWaypointsFromGrid\('manual'\)/);
  assert.match(element.innerHTML, /clearCellSelection\(\)/);
  assert.ok(element.innerHTML.endsWith('<p>meta</p>'));
});

test('empty selection hides waypoint actions while retaining exports', () => {
  const element = { style: {}, innerHTML: '' };
  render({ element, size: 20, total: 4, measured: 4, empty: 0, selected: 0, meta: '', translate: x => x, translateFormat: format });
  assert.doesNotMatch(element.innerHTML, /createWaypointsFromGrid/);
  assert.doesNotMatch(element.innerHTML, /clearCellSelection/);
  assert.match(element.innerHTML, /downloadGridGeoJSON/);
  assert.match(element.innerHTML, /downloadWaypointsCSV/);
});

test('missing summary element is a no-op', () => {
  assert.doesNotThrow(() => render({ element: null }));
});
