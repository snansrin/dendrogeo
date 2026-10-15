import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const files = [
  'src/domain/reports/resolve-publication-park-status.js',
  'src/ui/render-publication-park-row.js',
  'src/ui/render-publication-history.js',
  'src/application/reports/summarize-publication-queue.js',
  'src/ui/render-publication-admin-card.js',
];
const ctx = vm.createContext({ window: null, Object, Array, Number, String, Map });
ctx.window = ctx;
for (const file of files) vm.runInContext(read(file), ctx, { filename: file });

test('park status resolves retry, retraction and published states with existing precedence', () => {
  const park = { park_id: 7 };
  const state = {
    requests: [{ id: 'req1', park_id: 7, status: 'Beklemede' }],
    retractions: [{ id: 'ret1', park_id: 7, status: 'Beklemede' }],
    queue: { entries: [] },
  };
  const ports = {
    entryFor: id => id === 'req1' ? { status: 'Başarısız' } : null,
    publishedByPark: { 7: { report_id: 'DGR-2026-0001', doi: '10.5281/zenodo.12' } },
    retractionDone: () => null, retractedInPark: () => null,
    status: () => ({ key: 'pending', note: 'yeni istek' }),
    escape: String, translate: String, isDoi: value => /^10\.5281/.test(String(value)),
    isReportId: value => /^DGR-\d{4}-\d{4}$/.test(String(value)),
  };
  const result = ctx.DG_RESOLVE_PUBLICATION_PARK_STATUS.resolve(park, state, ports);
  assert.equal(result.status, 'pending');
  assert.equal(result.reportId, '');
  assert.match(result.note, /Önceki deneme başarısız/);
  state.retractions = [];
  state.requests = [];
  assert.equal(ctx.DG_RESOLVE_PUBLICATION_PARK_STATUS.resolve(park, state, ports).status, 'published');
});

test('park row preserves status actions, DOI and escaped park metadata without inline handlers', () => {
  const html = ctx.DG_RENDER_PUBLICATION_PARK_ROW.render(
    { park_id: 7, park_name: '<Park>', city: 'Ankara', records: 2, carbon_kg: 1234, area_m2: 10000 },
    { status: 'published', reportId: 'DGR-2026-0001', publication: { doi: '10.5281/zenodo.12' }, note: 'canlı' },
    { url: () => 'https://dendrogeo.org/rapor/DGR-2026-0001/', escape: x => String(x).replaceAll('<', '&lt;').replaceAll('>', '&gt;'), translate: String, isDoi: () => true, area: () => '1 ha' },
  );
  assert.match(html, /&lt;Park&gt;/);
  assert.match(html, /badge on/);
  assert.match(html, /data-publication-park-action="open" data-report-id="DGR-2026-0001"/);
  assert.match(html, /https:\/\/doi\.org\/10\.5281\/zenodo\.12/);
  assert.match(html, /data-publication-park-action="retract" data-report-id="DGR-2026-0001" data-park-id="7"/);
  assert.doesNotMatch(html, /onclick=/);
});

test('publication park-row delegation uses latest injected actions and reads control data', () => {
  const listeners = {};
  const root = {
    addEventListener: (name, listener) => { listeners[name] = listener; },
    contains: () => true,
  };
  let called = '';
  ctx.DG_RENDER_PUBLICATION_PARK_ROW.bind(root, { publish: control => { called = control.dataset.parkId; } });
  ctx.DG_RENDER_PUBLICATION_PARK_ROW.bind(root, { publish: control => { called = 'latest-' + control.dataset.parkId; } });
  listeners.click({ target: { closest: () => ({ dataset: { publicationParkAction: 'publish', parkId: '7' } }) } });
  assert.equal(called, 'latest-7');
});

test('history hides malformed IDs and retired links while keeping safe retraction history', () => {
  const queue = { entries: [
    { status: 'Yayınlandı', report_id: 'javascript:alert(1)', park_id: 2, request_id: 'r1' },
    { status: 'Yayınlandı', report_id: 'DGR-2026-0002', park_id: 2, request_id: 'r2' },
    { status: 'Geri çekildi', report_id: 'DGR-2026-0002', retraction_id: 'ret1', park_id: 2, reason: '<bad>' },
  ] };
  const html = ctx.DG_RENDER_PUBLICATION_HISTORY.render(queue, {
    retractedIds: () => ({ 'DGR-2026-0002': {} }),
    isReportId: value => /^DGR-\d{4}-\d{4}$/.test(String(value)),
    url: id => 'https://dendrogeo.org/rapor/' + id + '/', escape: x => String(x).replaceAll('<', '&lt;').replaceAll('>', '&gt;'), translate: String,
  });
  assert.doesNotMatch(html, /javascript:/);
  assert.doesNotMatch(html, /href="https:\/\/dendrogeo.org\/rapor\/DGR-2026-0002/);
  assert.match(html, /&lt;bad&gt;/);
  assert.match(html, /geri çekildi/i);
});

test('queue summary deduplicates request failures and the card renders status, table and help', () => {
  const state = {
    requests: [{ id: 'r1', status: 'Beklemede' }],
    queue: { entries: [
      { request_id: 'r1', status: 'Başarısız', message: 'old' },
      { request_id: 'r1', status: 'Başarısız', message: 'latest' },
    ] }, error: '',
  };
  const summary = ctx.DG_SUMMARIZE_PUBLICATION_QUEUE.summarize(state, { 1: { doi: '10.5281/zenodo.3' } }, {
    entryFor: () => ({ status: 'Başarısız' }), isDoi: value => /^10\.5281/.test(String(value)), escape: String,
  });
  assert.equal(summary.pending, 1);
  assert.equal(summary.activeCount, 1);
  assert.equal(summary.doiCount, 1);
  assert.equal(summary.failedCount, 1);
  assert.match(summary.failBanner, /latest/);
  const html = ctx.DG_RENDER_PUBLICATION_ADMIN_CARD.render({ summary, rows: '<tr>row</tr>', history: '<div>history</div>', error: '', queueMissing: false, escape: String, translate: String });
  assert.match(html, /admin-publish-table/);
  assert.match(html, /admin-publish-log/);
  assert.match(html, /admin-publish-help/);
  assert.match(ctx.DG_RENDER_PUBLICATION_ADMIN_CARD.schemaWarning(), /0008_report_publish\.sql/);
});

test('admin publication UI owns mounting, clock updates and loading feedback', () => {
  const card = ctx.DG_RENDER_PUBLICATION_ADMIN_CARD;
  const box = { innerHTML: '' }, clock = { textContent: '' };
  assert.equal(card.mount(box, '<section>card</section>'), true);
  assert.equal(box.innerHTML, '<section>card</section>');
  assert.equal(card.updateClock(clock, 'son kontrol'), true);
  assert.equal(clock.textContent, 'son kontrol');
  const document = { getElementById: id => id === 'dgPubBox' ? box : null };
  assert.equal(card.showLoading(document), true);
  assert.match(box.innerHTML, /Kuyruk yükleniyor/);
});

test('report service delegates the admin card render into five modules', () => {
  const service = read('src/services/report-publish.js');
  for (const name of ['DG_RESOLVE_PUBLICATION_PARK_STATUS', 'DG_RENDER_PUBLICATION_PARK_ROW',
    'DG_RENDER_PUBLICATION_HISTORY', 'DG_SUMMARIZE_PUBLICATION_QUEUE', 'DG_RENDER_PUBLICATION_ADMIN_CARD']) {
    assert.ok(service.includes('window.' + name), name);
  }
  assert.doesNotMatch(service, /\.innerHTML|\.textContent|\.classList|\.style\s*\./, 'servis DOM yazmaz veya görünüm durumunu okumaz');
});
