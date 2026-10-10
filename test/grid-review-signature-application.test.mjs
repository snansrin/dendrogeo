import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const context = vm.createContext({ window: {} });
vm.runInContext(readFileSync(new URL('../src/application/parks/grid-review-signature.js', import.meta.url), 'utf8'), context);
const resolve = context.window.DG_GRID_REVIEW_SIGNATURE.resolve;

test('grid review signature records the established surface invalidation fields in order', () => {
  const state = {
    epoch: 4,
    partitionVersion: 8,
    scannedAt: 'ignored top-level value',
    editing: true,
    record: {
      scannedAt: '2026-10-10T12:00:00Z',
      sens: { green: 40 },
      corrections: [{ id: 'c1' }],
      features: [{ id: 'f1' }],
      useObjects: true
    },
    incidental: 'not part of invalidation'
  };
  assert.equal(resolve(state), JSON.stringify([
    4, 8, '2026-10-10T12:00:00Z', true,
    { green: 40 }, [{ id: 'c1' }], [{ id: 'f1' }], true
  ]));
});

test('missing review record has no signature', () => {
  assert.equal(resolve(null), null);
  assert.equal(resolve({}), null);
});
