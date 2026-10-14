import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { loadApp } from '../scripts/test-harness.mjs';

const paths = [
  'src/application/admin/admin-tree-state.js',
  'src/application/admin/update-admin-tree-filter.js',
  'src/application/admin/open-pending-tree-nodes.js',
  'src/application/admin/expand-measurement-tree.js',
  'src/application/admin/set-admin-tree-node-open.js',
];
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
function setup() {
  const window = {};
  const context = vm.createContext({ window, Object, Array, String, Number, Set });
  for (const path of paths) vm.runInContext(read(path), context, { filename: path });
  return window;
}

test('admin tree store publishes frozen snapshots and copies open-key sets', () => {
  const api = setup(), store = api.DG_ADMIN_TREE_STATE.create(), updates = [];
  const initial = store.getState();
  const unsubscribe = store.subscribe(state => updates.push(state));
  store.setState({ status: 'Beklemede', query: 'çam', openKeys: new Set(['park-1']) });
  const current = store.getState();
  assert.equal(Object.isFrozen(initial), true);
  assert.equal(Object.isFrozen(current), true);
  assert.deepEqual(JSON.parse(JSON.stringify({ status: current.status, query: current.query, keys: [...current.openKeys] })),
    { status: 'Beklemede', query: 'çam', keys: ['park-1'] });
  assert.notEqual(current.openKeys, initial.openKeys);
  assert.equal(updates.length, 1);
  unsubscribe();
  store.setState({ query: '' });
  assert.equal(updates.length, 1);
});

test('filter, pending-open, expand and toggle workflows share the feature snapshot', () => {
  const api = setup(), store = api.DG_ADMIN_TREE_STATE.create(), draws = [];
  const state = store.getState();
  const set = patch => store.setState(patch);
  api.DG_UPDATE_ADMIN_TREE_FILTER.setStatus(state, 'Beklemede', { setStatus: value => set({ status: value }), draw: () => draws.push('status') });
  api.DG_UPDATE_ADMIN_TREE_FILTER.setQuery(store.getState(), 'çam', { setQuery: value => set({ query: value }), draw: () => draws.push('query') });
  assert.deepEqual({ status: store.getState().status, query: store.getState().query }, { status: 'Beklemede', query: 'çam' });

  const parks = [{ key: 'park-1', beklemede: 1, projects: [{ key: 'project-1', beklemede: 1, users: [{ key: 'user-1', beklemede: 1 }] }] }];
  const openState = store.getState();
  api.DG_OPEN_ADMIN_TREE_PENDING_NODES.open([], openState.status, openState.query, {
    filter: () => [], group: () => parks, openKeys: openState.openKeys, render: () => draws.push('pending'),
  });
  store.setState({ openKeys: openState.openKeys });
  assert.deepEqual([...store.getState().openKeys], ['park-1', 'project-1', 'user-1']);

  const expandState = store.getState();
  api.DG_EXPAND_ADMIN_MEASUREMENT_TREE.expand([], expandState.status, expandState.query, expandState.openKeys,
    { filter: () => [], group: () => parks, render: () => draws.push('expand') }, false);
  store.setState({ openKeys: expandState.openKeys });
  assert.deepEqual([...store.getState().openKeys], []);
  api.DG_SET_ADMIN_TREE_NODE_OPEN.set(store.getState().openKeys, 'park-2', true);
  store.setState({ openKeys: store.getState().openKeys });
  assert.deepEqual([...store.getState().openKeys], ['park-2']);
  assert.deepEqual(draws, ['status', 'query', 'pending', 'expand']);
});

test('admin tree store loads before the controllers, service and offline cache', () => {
  const head = read('partials/head.html'), sw = read('sw.js'), service = read('src/services/admin-tree.js');
  const name = 'src/application/admin/admin-tree-state.js';
  assert.ok(head.includes(name));
  assert.ok(sw.includes('/' + name));
  assert.ok(head.indexOf(name) < head.indexOf('src/application/admin/update-admin-tree-filter.js'));
  assert.ok(head.indexOf(name) < head.indexOf('src/services/admin-tree.js'));
  assert.match(service, /DG_ADMIN_TREE_STATE\.create/);
  assert.match(service, /DG_TREE_STATE_STORE\.subscribe/);
  assert.match(service, /DG_TREE_STATE_STORE\.getState\(\)/);
});

test('admin tree service keeps its legacy state names synchronized with the shared store', () => {
  const app = loadApp(['src/services/admin-tree.js']);
  assert.equal(vm.runInContext('DG_TREE_OPEN===DG_TREE_STATE_STORE.getState().openKeys', app), true);
  vm.runInContext(`
    dgTreeDraw=()=>{};
    dgTreeRender=()=>{window.testOpenKeys=[...DG_TREE_OPEN];};
    dgTreeFilterRows=()=>[];
    dgTreeGroup=()=>[{key:'park-a',beklemede:1,projects:[{key:'project-a',beklemede:1,users:[{key:'user-a',beklemede:1}]}]}];
    DG_TREE_ROWS=[];
    dgTreeOpenPending();
    dgTreeSetStatus("Beklemede");
    dgTreeSetQuery("çam");
    dgTreeToggle("park-1",true);
  `, app);
  const state = vm.runInContext('DG_TREE_STATE_STORE.getState()', app);
  assert.equal(state.status, 'Beklemede');
  assert.equal(state.query, 'çam');
  assert.deepEqual([...state.openKeys], ['park-a', 'project-a', 'user-a', 'park-1']);
  assert.deepEqual([...app.window.testOpenKeys], ['park-a', 'project-a', 'user-a']);
  assert.equal(vm.runInContext('DG_TREE_STATUS', app), 'Beklemede');
  assert.equal(vm.runInContext('DG_TREE_QUERY', app), 'çam');
  assert.deepEqual([...vm.runInContext('DG_TREE_OPEN', app)], ['park-a', 'project-a', 'user-a', 'park-1']);
});
