import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function loadModules() {
  const context = vm.createContext({ window: {}, Object, String, Number, Math, Map, Set, Promise });
  for (const file of [
    '../src/adapters/admin/admin-tree-store.js',
    '../src/domain/admin/group-measurement-tree.js',
    '../src/domain/admin/filter-measurement-tree.js',
    '../src/ui/admin-tree-formatters.js',
    '../src/ui/admin-tree-pending-summary.js',
    '../src/ui/admin-tree-measurement-row.js',
    '../src/ui/admin-tree-user.js',
    '../src/ui/admin-tree-project.js',
    '../src/ui/admin-tree-park.js',
    '../src/ui/admin-tree-view.js',
  ]) vm.runInContext(readFileSync(new URL(file, import.meta.url), 'utf8'), context);
  return context.window;
}

test('admin tree store prefers the named profile FK and keeps the embed result shape', async () => {
  const modules = loadModules();
  const calls = [];
  const rows = [{ id: 8 }];
  const query = {
    select(value, options) { calls.push(['select', value, options]); return this; },
    order(value, options) { calls.push(['order', value, options]); return this; },
    limit(value) { calls.push(['limit', value]); return Promise.resolve({ data: rows, count: 1, error: null }); },
  };
  const warnings = [];
  const result = await modules.DG_ADMIN_TREE_STORE.fetchRows({ from: table => { calls.push(['from', table]); return query; } }, (...args) => warnings.push(args));
  assert.equal(result.mode, 'embed');
  assert.equal(result.rows, rows);
  assert.ok(calls[1][1].includes('profiles!measurements_owner_fkey(full_name)'));
  assert.deepEqual(warnings[0], [rows, 1000, 'Yönetim ağacı', 1]);
});

test('tree group, Turkish filter, and deterministic helper preserve their public results', () => {
  const modules = loadModules();
  const random = modules.DG_VALIDATION_RNG;
  assert.equal(random, undefined, 'tree modules have no unrelated RNG dependency');
  const rows = [{ owner: 'u1', project_id: 4, park_id: 9, carbon_kg: 2, status: 'Beklemede', species: 'Çam', point_id: 1,
    projects: { id: 4, name: 'Göksu', parks: { id: 9, name: 'Göksu Parkı' } }, profiles: { full_name: 'İpek' } }];
  const tree = modules.DG_GROUP_MEASUREMENT_TREE.group(rows);
  assert.equal(tree[0].projects[0].users[0].name, 'İpek');
  assert.equal(tree[0].beklemede, 1);
  assert.equal(modules.DG_FILTER_MEASUREMENT_TREE.filter(rows, '', 'ÇAM').length, 1);
  assert.equal(modules.DG_FILTER_MEASUREMENT_TREE.filter(rows, 'Red', '').length, 0);
});

test('admin tree formatters retain labels and pending counts', () => {
  const formatters = loadModules().DG_ADMIN_TREE_FORMATTERS;
  assert.equal(formatters.tons(1250), '1.25 t');
  assert.match(formatters.pendingBadge(2), /title="2 kayıt onay bekliyor"/);
  assert.equal(formatters.statusSummary({ onayli: 1, beklemede: 2, red: 0 }),
    '<span class="dg-st-on">✓1</span> <span class="dg-st-wait">⏳2</span>');
  assert.equal(formatters.badge('Red', value => value), '<span class="badge off">Red</span>');
});

test('pending summary updates the side badge and hides an empty queue', () => {
  const summary = loadModules().DG_ADMIN_TREE_PENDING_SUMMARY;
  const updates = [];
  const box = { style: {}, innerHTML: 'old', className: '' };
  const group = rows => [{ beklemede: rows.length, projects: [] }];
  summary.render({ box, rows: [], group, updateSidebarBadge: n => updates.push(n), translate: value => value });
  assert.deepEqual(updates, [0]);
  assert.equal(box.style.display, 'none');
  assert.equal(box.innerHTML, '');
});

test('row, user, project, park, and tree renderers preserve the hierarchy and moderation actions', () => {
  const modules = loadModules();
  const ports = {
    escape: String, latin: { Çam: 'Pinus' }, thumbnail: () => '<img loading="lazy">', badge: status => status,
    openKeys: new Set(['u1', 'j4', 'p9']), translate: value => value, pendingBadge: n => n ? `pending:${n}` : '',
    tons: () => '1.00 t', statusSummary: () => 'status', rowHTML: () => '<tr></tr>',
    userHTML: () => '<details class="dg-tree-user"></details>', canDelete: true,
    projectHTML: () => '<details class="dg-tree-proj"></details>', formatHa: () => '1.00 ha',
  };
  const row = modules.DG_ADMIN_TREE_MEASUREMENT_ROW.render({ id: 1, point_id: 3, species: 'Çam', grp: 'İBRELİ', status: 'Beklemede',
    dbh_cm: 12, height_m: 4, carbon_kg: 2 }, ports);
  assert.ok(row.includes('approveMeas(1)') && row.includes('delMeas(1)') && row.includes('Pinus'));
  const user = modules.DG_ADMIN_TREE_USER.render({ key: 'u1', name: 'Araştırmacı', beklemede: 1, n: 1, c: 100, rows: [] }, ports);
  assert.ok(user.includes('ontoggle="dgTreeToggle(\'u1\',this.open)"') && user.includes(' open'));
  const project = modules.DG_ADMIN_TREE_PROJECT.render({ key: 'j4', name: 'Proje', project_id: 4, beklemede: 1, users: [], n: 1, c: 100 }, ports);
  assert.ok(project.includes('dgTreeDeleteProject(event,4)'));
  const park = modules.DG_ADMIN_TREE_PARK.render({ key: 'p9', name: 'Park', city: 'Ankara', area_m2: 10000, pending: false,
    beklemede: 1, projects: [{ users: [] }], n: 1, c: 1000 }, ports);
  assert.ok(park.includes('1.00 ha') && park.includes('1.00 t/ha'));
  const element = { innerHTML: '' };
  modules.DG_ADMIN_TREE_VIEW.render({ element, tree: [{ pending: false, projects: [], n: 1, c: 1000 }], rows: [], status: '', query: '',
    error: null, escape: String, translate: value => value, tons: () => '1.00 t', parkHTML: () => '<details class="dg-tree-park"></details>' });
  assert.ok(element.innerHTML.includes('dgTreeExpand(true)') && element.innerHTML.includes('dg-tree-park'));
});
