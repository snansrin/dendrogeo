import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../src/ui/publication-view-state.js', import.meta.url), 'utf8');
const context = vm.createContext({ window: null, Object });
context.window = context;
vm.runInContext(source, context, { filename: 'publication-view-state.js' });

test('publication view state reads active tabs, visibility and document visibility', () => {
  const elements = {
    'v-admin': { classList: { contains: value => value === 'on' } },
    'v-projects': { classList: { contains: () => false } },
    dgUserPubBox: { style: { display: 'block' } },
  };
  const document = { hidden: true, getElementById: id => elements[id] || null };
  const state = context.DG_PUBLICATION_VIEW_STATE.create(document);
  assert.equal(state.isActive('v-admin'), true);
  assert.equal(state.isActive('v-projects'), false);
  assert.equal(state.isActive('missing-view'), true);
  assert.equal(state.isVisible('dgUserPubBox'), true);
  elements.dgUserPubBox.style.display = 'none';
  assert.equal(state.isVisible('dgUserPubBox'), false);
  assert.equal(state.isDocumentHidden(), true);
});
