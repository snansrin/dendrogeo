import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const paths = [
  'src/application/park-invites/park-invite-state.js',
  'src/application/park-invites/load-owned-parks.js',
  'src/application/park-invites/load-recipient-invites.js',
  'src/application/park-invites/load-owner-collaborations.js',
  'src/application/park-invites/refresh-collaborations.js',
];
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
function setupContext() {
  const window = {}, context = vm.createContext({ window, Object, Array, String, Number, Promise, Set });
  for (const path of paths) vm.runInContext(read(path), context, { filename: path });
  return { window, context };
}
const setup = () => setupContext().window;

test('park invite store owns immutable snapshots and notifies subscribers', () => {
  const api = setup(), store = api.DG_PARK_INVITE_STATE.create({ mine: [{ id: 5 }] });
  const initial = store.getState(), updates = [];
  const unsubscribe = store.subscribe(state => updates.push(state));
  store.setState({ received: [{ id: 'i1' }] });
  assert.equal(Object.isFrozen(initial), true);
  assert.deepEqual(Array.from(initial.received), []);
  assert.equal(Object.isFrozen(store.getState()), true);
  assert.equal(store.getState().mine[0].id, 5);
  assert.equal(updates.length, 1);
  unsubscribe();
  store.setState({ loading: true });
  assert.equal(updates.length, 1);
});

test('owned park and recipient inbox workflows update the store and preserve legacy plain state', async () => {
  const api = setup(), store = api.DG_PARK_INVITE_STATE.create();
  const parks = [{ id: 5, role: 'owner' }];
  const loaded = await api.DG_LOAD_OWNED_INVITE_PARKS.execute(store, false, {
    hasClient: () => true, load: async () => ({ data: parks, error: null }), onMissingSchema() {},
  });
  assert.equal(loaded, parks);
  assert.equal(store.getState().mine, parks);
  const received = await api.DG_LOAD_RECIPIENT_PARK_INVITES.execute('ada@example.test', async () => ({
    data: [{ id: 'i1', email: 'Ada@example.test' }, { id: 'i2', email: 'other@example.test' }], error: null,
  }), store);
  assert.deepEqual(Array.from(received, row => row.id), ['i1']);
  assert.deepEqual(Array.from(store.getState().received, row => row.id), ['i1']);

  const legacy = { mine: null };
  await api.DG_LOAD_OWNED_INVITE_PARKS.execute(legacy, false, {
    hasClient: () => true, load: async () => ({ data: parks, error: null }), onMissingSchema() {},
  });
  assert.equal(legacy.mine, parks);
});

test('owner panel load and collaboration refresh share feature state without changing selector gates', async () => {
  const api = setup(), store = api.DG_PARK_INVITE_STATE.create(), events = [];
  const select = { value: '5', innerHTML: '' };
  await api.DG_LOAD_OWNER_PARK_COLLABORATIONS.execute({
    state: store, getSelect: () => select, isAuthenticated: () => true,
    hideCard: () => events.push('hide'), showCard: () => events.push('show'),
    loadParks: async () => { assert.equal(store.getState().loading, true); return [{ id: 5, role: 'owner' }]; }, owned: rows => rows.filter(row => row.role === 'owner'),
    shared: () => [], updateOwnedCount: () => {}, updateSharedCount: () => {}, clearCollaborations: () => {},
    render: () => events.push('render'), renderOptions: () => ({ html: '<option value="5">Park</option>', selected: '5' }),
    refresh: async () => events.push('refresh'),
  });
  assert.equal(store.getState().loading, false);
  assert.equal(store.getState().parks[0].id, 5);
  assert.equal(select.value, '5');
  assert.deepEqual(events, ['show', 'refresh']);

  select.value = '6';
  await api.DG_REFRESH_PARK_COLLABORATIONS.execute(store, {
    getSelect: () => select, canManage: id => id === 5, load: async () => { throw Error('must not read'); },
    onMissingSchema() {}, render: () => events.push('render'),
  });
  assert.equal(select.value, '');
  assert.deepEqual(Array.from(store.getState().invites), []);
  assert.deepEqual(Array.from(store.getState().collabs), []);

  select.value = '5';
  await api.DG_REFRESH_PARK_COLLABORATIONS.execute(store, {
    getSelect: () => select, canManage: id => id === 5,
    load: async () => [{ data: [{ id: 'i1' }], error: null }, { data: [{ user_id: 'u1' }], error: null }],
    onMissingSchema() {}, render: () => events.push('render'),
  });
  assert.equal(store.getState().invites[0].id, 'i1');
  assert.equal(store.getState().collabs[0].user_id, 'u1');
});

test('park invite feature store loads before the service and is available offline', () => {
  const head = read('partials/head.html'), sw = read('sw.js'), service = read('src/services/park-invites.js');
  const name = 'src/application/park-invites/park-invite-state.js';
  assert.ok(head.includes(name));
  assert.ok(sw.includes('/' + name));
  assert.ok(head.indexOf(name) < head.indexOf('src/application/park-invites/load-owned-parks.js'));
  assert.ok(head.indexOf(name) < head.indexOf('src/services/park-invites.js'));
  assert.match(service, /DG_PARK_INVITE_STATE\.create/);
  assert.match(service, /subscribe\(state=>Object\.assign\(DG_INV,state\)\)/);
  for (const path of paths.slice(1)) {
    assert.ok(head.includes(path), `${path} is loaded`);
    assert.ok(sw.includes('/' + path), `${path} is precached`);
  }
});

test('park invite service keeps DG_INV synchronized as a mutable compatibility view', () => {
  const { context, window } = setupContext();
  context.sb = {};
  vm.runInContext(read('src/services/park-invites.js'), context, { filename: 'src/services/park-invites.js' });
  vm.runInContext('dgInviteStateUpdate({mine:[{id:5,role:"owner"}],loading:true})', context);
  assert.equal(vm.runInContext('DG_INV.mine[0].id', context), 5);
  assert.equal(vm.runInContext('DG_INV.loading', context), true);
  assert.equal(vm.runInContext('DG_PARK_INVITE_STATE_STORE.getState().mine[0].id', context), 5);
  assert.equal(typeof window.DG_PARK_INVITE_STATE.create, 'function');
});
