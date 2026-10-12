import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const files = [
  'src/application/reports/load-publication-queue.js',
  'src/application/reports/schedule-publication-queue-poll.js',
  'src/application/reports/request-report-retraction.js',
  'src/application/reports/refresh-after-report-retraction.js',
  'src/application/reports/reset-publication-polling.js',
];
const ctx = vm.createContext({ window: null, Object, Array, String, Number, Promise });
ctx.window = ctx;
for (const file of files) vm.runInContext(read(file), ctx, { filename: file });

test('queue loader preserves parallel fetch, loading guard, state update and render order', async () => {
  const state = { loading: false, parks: [], requests: [], retractions: [], queue: { old: true }, queueAt: 0 };
  const calls = [];
  const ports = {
    hasView: () => true, showLoading: () => calls.push('loading'),
    loadParks: async () => { calls.push('parks'); return ['p']; },
    loadRequests: async () => { calls.push('requests'); return ['r']; },
    loadQueue: async () => { calls.push('queue'); return null; },
    loadRetractions: async () => { calls.push('retractions'); return ['x']; },
    now: () => 123, render: () => calls.push('render'), schedulePoll: () => calls.push('poll'),
  };
  await ctx.DG_LOAD_PUBLICATION_QUEUE.execute(state, {}, ports);
  assert.deepEqual(state, { loading: false, parks: ['p'], requests: ['r'], retractions: ['x'], queue: { old: true }, queueAt: 123 });
  assert.deepEqual(calls.slice(-2), ['render', 'poll']);
  assert.ok(calls.includes('loading'));
  state.loading = true;
  const count = calls.length;
  await ctx.DG_LOAD_PUBLICATION_QUEUE.execute(state, {}, ports);
  assert.equal(calls.length, count);
});

test('admin poll clears the old timer, only schedules pending work and checks view visibility', async () => {
  const state = { pollTimer: 3, pollCount: 0, requests: [{ id: 'r', status: 'Beklemede' }], retractions: [], queue: {} };
  let callback; const events = [];
  const ports = {
    clearTimer: id => events.push(['clear', id]), entryFor: () => null, retractionDone: () => null,
    maxPolls: 80, setInterval: (fn, ms) => { callback = fn; events.push(['interval', ms]); return 8; }, intervalMs: 25000,
    isAdminViewActive: () => false, isDocumentHidden: () => false, refresh: async () => events.push(['refresh']),
  };
  ctx.DG_SCHEDULE_PUBLICATION_QUEUE_POLL.execute(state, ports);
  assert.equal(state.pollTimer, 8);
  await callback();
  assert.equal(state.pollCount, 1);
  assert.equal(events.some(event => event[0] === 'refresh'), false);
  state.pollCount = 80;
  ctx.DG_SCHEDULE_PUBLICATION_QUEUE_POLL.execute(state, ports);
  assert.equal(state.pollTimer, 0);
  assert.deepEqual(events.filter(event => event[0] === 'clear'), [['clear', 3], ['clear', 8]]);
});

test('retraction workflow gates invalid/auth/cancel paths and clips prompted reason before insert', async () => {
  const events = [];
  let valid = true, authenticated = true, confirmed = true;
  let reason = 'x'.repeat(450);
  const ports = {
    isValidReportId: value => valid && String(value).startsWith('DGR-'), isAuthenticated: () => authenticated,
    onInvalidReport: () => events.push('invalid'), onUnauthenticated: () => events.push('auth'),
    confirm: () => confirmed, askReason: () => reason,
    insert: async (...args) => { events.push(['insert', ...args]); return { ok: true }; },
    onSuccess: async () => events.push('success'), onFailure: result => events.push(['failure', result]),
  };
  await ctx.DG_REQUEST_REPORT_RETRACTION.execute('bad', 3, ports);
  assert.deepEqual(events, ['invalid']);
  valid = true; authenticated = false;
  await ctx.DG_REQUEST_REPORT_RETRACTION.execute('DGR-2026-0003', 3, ports);
  assert.equal(events.at(-1), 'auth');
  authenticated = true; confirmed = false;
  await ctx.DG_REQUEST_REPORT_RETRACTION.execute('DGR-2026-0003', 3, ports);
  assert.equal(events.length, 2);
  confirmed = true;
  await ctx.DG_REQUEST_REPORT_RETRACTION.execute('DGR-2026-0003', 3, ports);
  assert.equal(events.at(-1), 'success');
  assert.equal(events[2][0], 'insert');
  assert.equal(events[2][3].length, 400);
});

test('post-retraction refresh targets only visible admin and selected user panels; poll counters reset', async () => {
  const events = [];
  await ctx.DG_REFRESH_AFTER_REPORT_RETRACTION.execute({ parkId: 6 }, {
    hasAdminView: () => true, refreshAdmin: async () => events.push('admin'), refreshUser: async () => events.push('user'),
  });
  assert.deepEqual(events, ['admin', 'user']);
  await ctx.DG_REFRESH_AFTER_REPORT_RETRACTION.execute({ parkId: 0 }, {
    hasAdminView: () => false, refreshAdmin: async () => events.push('admin'), refreshUser: async () => events.push('user'),
  });
  assert.deepEqual(events, ['admin', 'user']);
  const admin = { pollCount: 9 }, user = { polls: 4 };
  ctx.DG_RESET_PUBLICATION_POLLING.reset(admin, user);
  assert.deepEqual([admin.pollCount, user.polls], [0, 0]);
});

test('service delegates queue and retraction responsibilities into the modules', () => {
  const service = read('src/services/report-publish.js');
  for (const name of ['DG_LOAD_PUBLICATION_QUEUE', 'DG_SCHEDULE_PUBLICATION_QUEUE_POLL',
    'DG_REQUEST_REPORT_RETRACTION', 'DG_REFRESH_AFTER_REPORT_RETRACTION', 'DG_RESET_PUBLICATION_POLLING']) {
    assert.ok(service.includes('window.' + name), name);
  }
});
