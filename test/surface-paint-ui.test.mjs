import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../src/ui/lc-sens.js', import.meta.url), 'utf8');
const shell = readFileSync(new URL('../partials/shell.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../css/park-panel.css', import.meta.url), 'utf8');

function editorContext() {
  const pans = [], handlers = new Map();
  const container = {
    style: {}, classList: { add() {}, remove() {} },
    addEventListener(name, fn) { handlers.set(name, fn); },
    removeEventListener(name) { handlers.delete(name); },
    setPointerCapture() {}, releasePointerCapture() {},
  };
  const context = vm.createContext({
    window: { DG_SURFACE_REVIEW: { types: { green: {}, hard: {}, water: {}, building: {}, pool: {}, bare: {} } } },
    document: { getElementById: () => null },
    map: { getContainer: () => container, panBy: (delta) => pans.push(Array.from(delta)) },
  });
  vm.runInContext(source, context);
  return { context, pans, handlers };
}

test('brush toolbar is placed below marker refresh and exposes the established cell brush', () => {
  assert.ok(shell.indexOf('loadLiveMap()') < shell.indexOf('id="surfaceBrushTools"'));
  assert.match(source, /function dgSensBrushCellKeys\(points,diameter\)/);
  assert.match(source, /function dgSensSetCellDecision\(cell,toCls/);
  assert.match(source, /method:"visual-cell"/);
  assert.match(source, /dgSensBrushCommit\(points,b\.type,b\.diameter\)/);
  assert.match(source, /Sol tuşla fırçala; sağ tuşla haritayı kaydır/);
  assert.match(css, /\.dg-paint-swatch\.is-selected/);
});

test('right-button drag pans map without replacing the existing left-button brush handlers', () => {
  const { context, pans, handlers } = editorContext();
  vm.runInContext('dgSensBindRightPan()', context);
  handlers.get('pointerdown')({ button: 2, isPrimary: true, pointerId: 4, clientX: 20, clientY: 30, preventDefault() {}, stopImmediatePropagation() {} });
  handlers.get('pointermove')({ pointerId: 4, clientX: 28, clientY: 25, preventDefault() {}, stopImmediatePropagation() {} });
  handlers.get('pointerup')({ pointerId: 4, preventDefault() {}, stopImmediatePropagation() {} });
  assert.deepEqual(pans, [[-8, 5]]);
  assert.equal(vm.runInContext('DG_SENS.rightPan.stroke', context), null);
  assert.equal(handlers.has('contextmenu'), true);
});
