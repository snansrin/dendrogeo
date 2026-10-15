import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const modules = [
  'src/domain/users/summarize-tree-analysis.js',
  'src/ui/tree-analysis.js',
  'src/adapters/world/world-stats-store.js',
  'src/ui/world-stats-tables.js',
  'src/ui/world-error.js',
];
function runtime() {
  const context = { window: {} };
  vm.createContext(context);
  for (const path of modules) vm.runInContext(readFileSync(join(ROOT, path), 'utf8'), context);
  return context.window;
}

test('tree analysis summary preserves groups, averages, percentages, and top-six ordering', () => {
  const api = runtime();
  const rows = [
    { grp: 'İBRELİ', species: 'Çam', dbh_cm: 10, height_m: 5 },
    { grp: 'İBRELİ', species: 'Çam', dbh_cm: 20, height_m: 7 },
    { grp: 'YAPRAKLI', species: 'Meşe', dbh_cm: 30, height_m: 9 },
    { grp: 'Bilinmiyor', species: 'Diğer', dbh_cm: 40, height_m: 11 },
    ...['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((species) => ({ grp: 'YAPRAKLI', species, dbh_cm: 0, height_m: 1 })),
  ];
  const result = api.DG_TREE_ANALYSIS_SUMMARY.summarize(rows);
  assert.equal(result.total, 11);
  assert.equal(result.averageDbh, '9.1');
  assert.equal(result.averageHeight, '3.5');
  assert.equal(result.groups['DİĞER'].n, 1);
  assert.equal(result.percent.conifer, '18.2');
  assert.deepEqual(JSON.parse(JSON.stringify(result.topSpecies.map(([name]) => name))), ['Çam', 'Meşe', 'Diğer', 'A', 'B', 'C']);
  assert.equal(api.DG_TREE_ANALYSIS_SUMMARY.summarize([]), null);
});

test('tree analysis UI renders accessible group colors and escaped species labels', () => {
  const api = runtime();
  const summary = api.DG_TREE_ANALYSIS_SUMMARY.summarize([
    { grp: 'İBRELİ', species: '<img>', dbh_cm: 10, height_m: 4 },
    { grp: 'YAPRAKLI', species: 'Meşe', dbh_cm: 20, height_m: 8 },
  ]);
  const html = api.DG_TREE_ANALYSIS_UI.render(summary, {
    groupColor: { 'İBRELİ': '#111', 'YAPRAKLI': '#222', 'DİĞER': '#333' },
    groupColorInk: { 'İBRELİ': '#444', 'YAPRAKLI': '#555' },
    escape: (value) => String(value ?? '').replaceAll('<', '&lt;').replaceAll('>', '&gt;'),
    latin: { '<img>': 'Pinus' },
  });
  assert.match(html, /En Yaygın 6 Tür/);
  assert.match(html, /&lt;img&gt;/);
  assert.match(html, /Pinus/);
  assert.match(html, /Ort\. Çap/);
  assert.match(html, /width:50\.0%/);
  const element={innerHTML:''},document={getElementById:id=>id==='analysis'?element:null};
  assert.equal(api.DG_TREE_ANALYSIS_UI.mount(document,'analysis',html),true);
  assert.equal(element.innerHTML,html);
});

test('world store reads global, country, and city views in the existing order', async () => {
  const api = runtime();
  const calls = [];
  const sb = { from(view) {
    calls.push(view);
    const query = { select() { return this; }, single() { return Promise.resolve({ data: { view } }); } };
    if (view !== 'v_global') return { select: () => Promise.resolve({ data: [{ view }] }) };
    return query;
  } };
  const result = await api.DG_WORLD_STATS_STORE.load(sb);
  assert.deepEqual(calls, ['v_global', 'v_country', 'v_city']);
  assert.equal(result.global.data.view, 'v_global');
  assert.equal(result.countries.data[0].view, 'v_country');
  assert.equal(result.cities.data[0].view, 'v_city');
});

test('world tables escape locations, retain labels and cap output at 30 rows', () => {
  const api = runtime();
  const escape = (value) => String(value ?? '').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  const countries = Array.from({ length: 31 }, (_, index) => ({ country: index ? 'Türkiye' : '<ülke>', records: index, carbon_t: 1, avg_dbh: 12.34, avg_height: 7 }));
  const countryHtml = api.DG_WORLD_STATS_TABLES.countries(countries, escape);
  assert.equal((countryHtml.match(/<tr>/g) || []).length, 30);
  assert.match(countryHtml, /&lt;ülke&gt;/);
  assert.match(countryHtml, /12\.3/);
  assert.match(api.DG_WORLD_STATS_TABLES.cities([{ city: '<şehir>', records: 2, carbon_t: 1 }], escape), /&lt;şehir&gt;/);
  assert.match(api.DG_WORLD_STATS_TABLES.countries([], escape), /colspan=5/);
  assert.match(api.DG_WORLD_STATS_TABLES.cities([], escape), /colspan=3/);
});

test('world error UI escapes the database detail and keeps the retry action', () => {
  const api = runtime();
  const html = api.DG_WORLD_ERROR_UI.render('<script>alert(1)</script>', (value) => String(value).replaceAll('<', '&lt;').replaceAll('>', '&gt;'));
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /onclick="loadWorld\(\)"/);
  assert.match(html, /Dünya verisi yüklenemedi/);
  const box={style:{},className:'',innerHTML:''},document={getElementById:id=>id==='worldErr'?box:null};
  assert.equal(api.DG_WORLD_ERROR_UI.show(document,'<unsafe>',value=>String(value).replaceAll('<','&lt;').replaceAll('>','&gt;')),true);
  assert.equal(box.className,'alert err');assert.match(box.innerHTML,/&lt;unsafe&gt;/);
  api.DG_WORLD_ERROR_UI.hide(document);assert.equal(box.style.display,'none');
});
