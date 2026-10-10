import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const context = vm.createContext({ window: {} });
vm.runInContext(readFileSync(new URL('../src/application/parks/resolve-grid-waypoint-readiness.js', import.meta.url), 'utf8'), context);
const resolve = context.window.DG_GRID_WAYPOINT_READINESS.resolve;
const cells = [{ id: 1 }, { id: 2 }];
const select = (items, mode, selected) => mode === 'manual' ? items.filter(cell => selected.has(cell.id)) : items.filter(cell => cell.id === 2);
const run = overrides => resolve({
  cells, mode: 'auto', selectedCells: new Set(), source: 'sig',
  getCurrentSource: () => 'sig', getProjectId: () => 7, select, ...overrides
});

test('preflight reports the first failing condition in the existing user-facing order', () => {
  assert.equal(run({ cells: [] }).reason, 'grid-missing');
  assert.equal(run({ getCurrentSource: () => 'newer', getProjectId: () => 0 }).reason, 'surface-stale');
  assert.equal(run({ getProjectId: () => 0 }).reason, 'project-missing');
  assert.equal(run({ mode: 'manual', selectedCells: new Set() }).reason, 'manual-selection-missing');
  assert.equal(run({ select: () => [] }).reason, 'target-cells-missing');
});

test('valid request returns the selection result and project id', () => {
  const result = run({ mode: 'manual', selectedCells: new Set([2, 1]) });
  assert.equal(result.ok, true);
  assert.deepEqual(JSON.parse(JSON.stringify(result.targetCells)), cells);
  assert.equal(result.projectId, 7);
});

test('state reads and selection run only after preceding guards pass', () => {
  let signatureRead = false, projectRead = false, selectionRun = false;
  const options = {
    getCurrentSource: () => { signatureRead = true; return 'sig'; },
    getProjectId: () => { projectRead = true; return 7; },
    select: (...args) => { selectionRun = true; return select(...args); }
  };
  assert.equal(run({ ...options, cells: [] }).reason, 'grid-missing');
  assert.deepEqual([signatureRead, projectRead, selectionRun], [false, false, false]);
  assert.equal(run({ ...options, getCurrentSource: () => { signatureRead = true; return 'old'; } }).reason, 'surface-stale');
  assert.deepEqual([signatureRead, projectRead, selectionRun], [true, false, false]);
  assert.equal(run({ ...options, getProjectId: () => { projectRead = true; return 0; } }).reason, 'project-missing');
  assert.deepEqual([signatureRead, projectRead, selectionRun], [true, true, false]);
});
