import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const files = [
  'src/application/reports/publication-queue-state.js',
  'src/domain/reports/has-pending-publication-work.js',
  'src/application/reports/load-publication-queue.js',
  'src/application/reports/schedule-publication-queue-poll.js',
  'src/application/reports/reset-publication-polling.js',
];
function setup() {
  const window = {};
  const context = vm.createContext({ window, Object, Array, String, Number, Promise, Set });
  for (const file of files) vm.runInContext(read(file), context, { filename: file });
  return context;
}

test('publication queue store owns immutable snapshots and notifies subscribers', () => {
  const ctx = setup(), store = ctx.window.DG_PUBLICATION_QUEUE_STATE.create({ pollCount: 4 });
  const events = [], unsubscribe = store.subscribe(state => events.push(state));
  const initial = store.getState();
  store.setState({ error: 'SCHEMA' });
  assert.equal(initial.error, '');
  assert.equal(Object.isFrozen(store.getState()), true);
  assert.equal(store.getState().pollCount, 4);
  assert.equal(events.length, 1);
  unsubscribe();
  store.setState({ error: '' });
  assert.equal(events.length, 1);
});

test('queue load updates store snapshots while keeping parallel reads and existing order', async () => {
  const ctx = setup(), store = ctx.window.DG_PUBLICATION_QUEUE_STATE.create({ queue: { old: true } });
  const calls = [];
  const ports = {
    hasView: () => true, showLoading: () => calls.push('loading'),
    loadParks: async () => { calls.push('parks'); return ['p']; },
    loadRequests: async () => { calls.push('requests'); return ['r']; },
    loadQueue: async () => { calls.push('queue'); return null; },
    loadRetractions: async () => { calls.push('retractions'); return ['x']; },
    now: () => 123, render: () => calls.push('render'), schedulePoll: () => calls.push('poll'),
  };
  await ctx.window.DG_LOAD_PUBLICATION_QUEUE.execute(store, {}, ports);
  assert.deepEqual({ ...store.getState() }, {
    parks: ['p'], requests: ['r'], retractions: ['x'], queue: { old: true }, queueAt: 123,
    error: '', loading: false, pollTimer: 0, pollCount: 0,
  });
  assert.deepEqual(calls.slice(-2), ['render', 'poll']);
  assert.ok(calls.includes('loading'));
  store.setState({ loading: true });
  const count = calls.length;
  await ctx.window.DG_LOAD_PUBLICATION_QUEUE.execute(store, {}, ports);
  assert.equal(calls.length, count);
});

test('poll policy and scheduler preserve pending gates, interval, and state updates', async () => {
  const ctx = setup(), store = ctx.window.DG_PUBLICATION_QUEUE_STATE.create({
    pollTimer: 3, pollCount: 0, requests: [{ id: 'r', status: 'Beklemede' }], retractions: [], queue: {},
  });
  const events = []; let callback;
  const pending = (state, entryFor = () => null) => ctx.window.DG_HAS_PENDING_PUBLICATION_WORK.check(state, {
    entryFor, retractionDone: () => null,
  });
  const ports = {
    hasPending: pending, clearTimer: id => events.push(['clear', id]), maxPolls: 80,
    setInterval: (fn, ms) => { callback = fn; events.push(['interval', ms]); return 8; }, intervalMs: 25000,
    isAdminViewActive: () => false, isDocumentHidden: () => false, refresh: async () => events.push(['refresh']),
  };
  ctx.window.DG_SCHEDULE_PUBLICATION_QUEUE_POLL.execute(store, ports);
  assert.equal(store.getState().pollTimer, 8);
  await callback();
  assert.equal(store.getState().pollCount, 1);
  assert.equal(events.some(event => event[0] === 'refresh'), false);
  assert.equal(pending({ requests: [{ id: 'r', status: 'Beklemede' }], retractions: [] }), true);
  assert.equal(pending({ requests: [{ id: 'r', status: 'Beklemede' }], retractions: [] }, () => ({})), false);
  store.setState({ pollCount: 80 });
  ctx.window.DG_SCHEDULE_PUBLICATION_QUEUE_POLL.execute(store, ports);
  assert.equal(store.getState().pollTimer, 0);
  assert.deepEqual(events.filter(event => event[0] === 'clear'), [['clear', 3], ['clear', 8]]);
});

test('poll reset updates both the admin store and the existing user panel state', () => {
  const ctx = setup(), admin = ctx.window.DG_PUBLICATION_QUEUE_STATE.create({ pollCount: 9 });
  const user = { polls: 4 };
  ctx.window.DG_RESET_PUBLICATION_POLLING.reset(admin, user);
  assert.equal(admin.getState().pollCount, 0);
  assert.equal(user.polls, 0);
});

test('five state and policy modules load before the publication service and are precached', () => {
  const head = read('partials/head.html'), sw = read('sw.js'), service = read('src/services/report-publish.js');
  for (const path of files) {
    assert.ok(head.includes(path), `${path} loaded`);
    assert.ok(sw.includes(`/${path}`), `${path} precached`);
  }
  assert.ok(head.indexOf('publication-queue-state.js') < head.indexOf('load-publication-queue.js'));
  assert.ok(head.indexOf('has-pending-publication-work.js') < head.indexOf('schedule-publication-queue-poll.js'));
  assert.ok(head.indexOf('reset-publication-polling.js') < head.indexOf('src/services/report-publish.js'));
  assert.match(service, /DG_PUBLICATION_QUEUE_STATE\.create/);
  assert.match(service, /DG_HAS_PENDING_PUBLICATION_WORK\.check/);
});
