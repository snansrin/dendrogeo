import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const files = [
  'src/application/reports/resolve-user-publication-view.js',
  'src/ui/render-user-publication-controls.js',
  'src/ui/render-user-publication-header.js',
  'src/ui/render-user-publication-notices.js',
  'src/ui/render-user-publication-card.js',
];
const ctx = vm.createContext({ window: null, Object, Array, String, Number, Date });
ctx.window = ctx;
for (const file of files) vm.runInContext(read(file), ctx, { filename: file });

test('user view preserves another contributor ownership and publication status precedence', () => {
  const state = {
    requests: [{ id: 'r1', status: 'Beklemede', requested_by: 'u2', created_at: new Date().toISOString() }],
    retracts: [], queue: {}, parkId: 6, parkName: '<Park>', ownApproved: 0,
  };
  const ports = {
    entryFor: () => null, publishedInPark: () => null, retractionDone: () => null, retractedInPark: () => null,
    isReportId: value => /^DGR-\d{4}-\d{4}$/.test(String(value)), url: () => '', translate: String, now: Date.now,
  };
  let view = ctx.DG_RESOLVE_USER_PUBLICATION_VIEW.resolve(state, 'u1', ports);
  assert.equal(view.pendingOwn, false);
  assert.match(view.badge, /badge admin/);
  assert.match(view.note, /başka bir katkıda bulunan/);
  state.requests[0].requested_by = 'u1';
  view = ctx.DG_RESOLVE_USER_PUBLICATION_VIEW.resolve(state, 'u1', ports);
  assert.equal(view.pendingOwn, true);
  let html = ctx.DG_RENDER_USER_PUBLICATION_CONTROLS.render(view, state, { escape: String });
  assert.match(html, /dgUserCancel\('r1'\)/);
  assert.doesNotMatch(html, /dgUserPublish/);
  assert.doesNotMatch(html, /dgUserPubLulc/);
});

test('published and retracted view controls preserve valid links and hide unavailable actions', () => {
  const state = { requests: [], retracts: [], queue: {}, parkId: 6, parkName: '<Park>', ownApproved: 2 };
  const ports = {
    entryFor: () => null, publishedInPark: () => ({ report_id: 'DGR-2026-0006', finished_at: '2026-10-01' }),
    retractionDone: () => null, retractedInPark: () => null,
    isReportId: value => /^DGR-\d{4}-\d{4}$/.test(String(value)),
    url: id => id ? 'https://dendrogeo.org/rapor/' + id + '/' : '', translate: String, now: Date.now,
  };
  const view = ctx.DG_RESOLVE_USER_PUBLICATION_VIEW.resolve(state, 'u1', ports);
  assert.match(view.badge, /badge on/);
  const controls = ctx.DG_RENDER_USER_PUBLICATION_CONTROLS.render(view, state, { escape: String });
  assert.match(controls, /dgReportShare/);
  assert.match(controls, /dgReportRetract\('DGR-2026-0006',6\)/);
  assert.match(controls, /dgUserPublish\(6\)/);
  const header = ctx.DG_RENDER_USER_PUBLICATION_HEADER.render(state, view, '<button>close</button>', value => String(value).replaceAll('<', '&lt;').replaceAll('>', '&gt;'));
  assert.match(header, /&lt;Park&gt;/);
  assert.match(header, /Kalıcı bağlant/);
});

test('notices and card keep the own-measurement, offline and schema guidance', () => {
  const state = { ownApproved: 0, queue: null };
  const notices = ctx.DG_RENDER_USER_PUBLICATION_NOTICES.render(state, String);
  assert.match(notices, /onaylı ölçümün görünmüyor/);
  assert.match(notices, /Yayın günlüğü okunamadı/);
  assert.match(notices, /park düzeyindedir/);
  assert.match(ctx.DG_RENDER_USER_PUBLICATION_CARD.schemaWarning('<button>close</button>'), /0009_user_report_publish\.sql/);
  assert.equal(ctx.DG_RENDER_USER_PUBLICATION_CARD.render(state, 'SCHEMA', 'header', 'controls', 'notices', String), '<div class="alert err">⚠ SCHEMA</div>headercontrolsnotices');
});

test('user publication UI owns mounting the rendered panel', () => {
  const box = { innerHTML: '' };
  assert.equal(ctx.DG_RENDER_USER_PUBLICATION_CARD.mount(box, '<section>panel</section>'), true);
  assert.equal(box.innerHTML, '<section>panel</section>');
  assert.equal(ctx.DG_RENDER_USER_PUBLICATION_CARD.mount(null, 'ignored'), false);
});

test('report service delegates user publication view and card rendering to modules', () => {
  const service = read('src/services/report-publish.js');
  for (const name of ['DG_RESOLVE_USER_PUBLICATION_VIEW', 'DG_RENDER_USER_PUBLICATION_CONTROLS',
    'DG_RENDER_USER_PUBLICATION_HEADER', 'DG_RENDER_USER_PUBLICATION_NOTICES', 'DG_RENDER_USER_PUBLICATION_CARD']) {
    assert.ok(service.includes('window.' + name), name);
  }
  assert.doesNotMatch(service, /\.innerHTML|\.textContent|\.classList|\.style\s*\./, 'servis DOM yazmaz veya görünüm durumunu okumaz');
});
