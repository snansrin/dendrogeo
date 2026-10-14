import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
function load(paths) {
  const ctx = vm.createContext({ window: null, Object, Array, Number, String, Promise });
  ctx.window = ctx;
  for (const path of paths) vm.runInContext(read(path), ctx, { filename: path });
  return ctx;
}

const modules = [
  'src/ui/open-user-publication-panel.js',
  'src/ui/close-user-publication-panel.js',
  'src/application/reports/sync-user-publication-panel.js',
  'src/application/reports/schedule-user-publication-poll.js',
  'src/application/reports/share-report-link.js',
];

test('panel open preserves auth, project, park gates and initializes before refresh', async () => {
  const ctx = load(modules);
  const box = { style: {}, innerHTML: '', scrollIntoView() { this.scrolled = true; } };
  const events = [];
  const ports = {
    getBox: () => box,
    isAuthenticated: () => true,
    findProject: id => id === 3 ? { id: '3', park_id: '7', park_name: 'Park' } : null,
    onUnauthenticated: () => events.push('auth'),
    onMissingProject: () => events.push('missing'),
    onUnlinkedProject: () => events.push('unlinked'),
    stopPolling: () => events.push('stop'),
    selectProject: project => events.push(project),
    refresh: async () => { events.push('refresh'); },
  };
  await ctx.DG_OPEN_USER_PUBLICATION_PANEL.execute(3, ports);
  assert.deepEqual(events, ['stop', { id: '3', park_id: '7', park_name: 'Park' }, 'refresh']);
  assert.equal(box.style.display, '');
  assert.match(box.innerHTML, /Rapor durumu yükleniyor/);
  assert.equal(box.scrolled, true);
  ports.isAuthenticated = () => false;
  await ctx.DG_OPEN_USER_PUBLICATION_PANEL.execute(3, ports);
  assert.equal(events.at(-1), 'auth');
  ports.isAuthenticated = () => true;
  await ctx.DG_OPEN_USER_PUBLICATION_PANEL.execute(99, ports);
  assert.equal(events.at(-1), 'missing');
  ports.findProject = () => ({ id: 4, park_id: null });
  await ctx.DG_OPEN_USER_PUBLICATION_PANEL.execute(4, ports);
  assert.equal(events.at(-1), 'unlinked');
});

test('panel close clears polling, selection and markup; sync closes only removed selection', () => {
  const ctx = load(modules);
  const state = { timer: 12, projectId: 4, parkId: 8 };
  const box = { style: {}, innerHTML: 'panel' };
  const cleared = [];
  const close = () => ctx.DG_CLOSE_USER_PUBLICATION_PANEL.execute(state, {
    clearTimer: id => cleared.push(id), getBox: () => box,
  });
  ctx.DG_SYNC_USER_PUBLICATION_PANEL.execute(state, [{ id: 4 }], close);
  assert.equal(state.projectId, 4);
  ctx.DG_SYNC_USER_PUBLICATION_PANEL.execute(state, [], close);
  assert.deepEqual(cleared, [12]);
  assert.deepEqual(state, { timer: 0, projectId: 0, parkId: 0 });
  assert.deepEqual(box.style, { display: 'none' });
  assert.equal(box.innerHTML, '');
});

test('poll scheduler needs a pending owned request and enforces timer/view gates', async () => {
  const ctx = load(modules);
  let callback; const clears = []; const refreshed = [];
  const state = {
    timer: 5, polls: 0, queue: {},
    requests: [{ id: 'mine', status: 'Beklemede', requested_by: 'u1' }],
    retracts: [],
  };
  const ports = {
    clearTimer: id => clears.push(id), userId: () => 'u1',
    entryFor: () => null, retractionDone: () => null,
    maxPolls: 80, setInterval: (fn, ms) => { callback = fn; assert.equal(ms, 25000); return 9; },
    intervalMs: 25000, isProjectsTabActive: () => true, isDocumentHidden: () => false,
    isPanelVisible: () => true, refresh: async () => refreshed.push(true),
  };
  ctx.DG_SCHEDULE_USER_PUBLICATION_POLL.execute(state, ports);
  assert.deepEqual(clears, [5]);
  assert.equal(state.timer, 9);
  ports.isDocumentHidden = () => true;
  await callback();
  assert.equal(state.polls, 1);
  assert.equal(refreshed.length, 0);
  ports.isDocumentHidden = () => false;
  await callback();
  assert.equal(refreshed.length, 1);
  state.requests[0].requested_by = 'someone-else';
  ctx.DG_SCHEDULE_USER_PUBLICATION_POLL.execute(state, ports);
  assert.equal(state.timer, 0);
});

test('report share uses native share, clipboard and prompt fallbacks; open validates URL', async () => {
  const ctx = load(modules);
  const calls = [];
  const ports = {
    parkName: 'Park', url: id => id === 'DGR-2026-0001' ? 'https://dendrogeo.org/rapor/DGR-2026-0001/' : '',
    share: async data => calls.push(['share', data]), copy: async url => calls.push(['copy', url]),
    copied: url => calls.push(['copied', url]), prompt: url => calls.push(['prompt', url]),
    invalidLink: () => calls.push(['invalid']), open: url => calls.push(['open', url]),
  };
  await ctx.DG_SHARE_REPORT_LINK.share('DGR-2026-0001', ports);
  assert.equal(calls[0][0], 'share');
  assert.equal(calls[0][1].url, 'https://dendrogeo.org/rapor/DGR-2026-0001/');
  ports.share = async () => { throw new Error('dismissed'); };
  await ctx.DG_SHARE_REPORT_LINK.share('DGR-2026-0001', ports);
  assert.deepEqual(calls.slice(1).map(row => row[0]), ['copy', 'copied']);
  ports.copy = async () => { throw new Error('clipboard unavailable'); };
  await ctx.DG_SHARE_REPORT_LINK.share('DGR-2026-0001', ports);
  assert.equal(calls.at(-1)[0], 'prompt');
  ctx.DG_SHARE_REPORT_LINK.open('DGR-2026-0001', ports);
  assert.deepEqual(calls.at(-1), ['open', 'https://dendrogeo.org/rapor/DGR-2026-0001/']);
  ctx.DG_SHARE_REPORT_LINK.open('bad', ports);
  assert.equal(calls.at(-1)[0], 'invalid');
});

test('service delegates the five user panel actions into their modules', () => {
  const service = read('src/services/report-publish.js');
  for (const name of ['DG_OPEN_USER_PUBLICATION_PANEL', 'DG_CLOSE_USER_PUBLICATION_PANEL',
    'DG_SYNC_USER_PUBLICATION_PANEL', 'DG_SCHEDULE_USER_PUBLICATION_POLL', 'DG_SHARE_REPORT_LINK']) {
    assert.ok(service.includes('window.' + name), name);
  }
  assert.match(service, /open:url=>window\.open\(url,"_blank","noopener"\)/);
});
