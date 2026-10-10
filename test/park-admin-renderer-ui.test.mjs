import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const context = vm.createContext({ window: {} });
vm.runInContext(readFileSync(new URL('../src/ui/park-admin-renderer.js', import.meta.url), 'utf8'), context);
const render = context.window.DG_PARK_ADMIN_RENDERER.render;
const fmt = (template, values) => template.replace(/\{(\w+)\}/g, (_, key) => values[key]);
const escapeHTML = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const parks = [{ id: 1, name: 'Alpha <Park>', osm_key: 'way/1', city: 'Ankara', source: 'osm', area_m2: 10000, centroid_lat: 39.9, centroid_lon: 32.8 }, { id: 2, name: 'Alpha', osm_key: 'way/2', source: 'manual', area_m2: 20000, centroid_lat: 39.91, centroid_lon: 32.81 }];
const overview = {
  projByPark: { 1: 2 }, measByPark: { 2: 3 }, emptyRows: [{ id: 3 }], shown: parks,
  dupGroups: [parks], unnamed: [{ id: 2 }]
};
const renderHTML = overrides => {
  const element = { innerHTML: '' };
  render({ element, rows: parks, overview, showEmpty: false, formatHectares: value => `${value/10000} ha`, distance: () => 120, escapeHTML, translate: value => value, translateFormat: fmt, translatePlain: value => value, ...overrides });
  return element.innerHTML;
};

test('renderer keeps duplicate, unnamed, empty-park, and row actions', () => {
  const html = renderHTML({});
  assert.match(html, /çift kimlik adayı var/);
  assert.match(html, /mesafe <b>120 m<\/b>/);
  assert.match(html, /Alpha &lt;Park&gt;/);
  assert.match(html, /parkın adı yok/);
  assert.match(html, /Boş parkları göster \(1\)/);
  assert.match(html, /dgParkMergeInto\(2,1\)/);
  assert.match(html, /dgParkRename\(1\)/);
  assert.match(html, /dgBackfillGeom\(1\)/);
  assert.match(html, /dgParkDelete\(1\)/);
});

test('visible-empty mode changes the toggle label and omits the hidden-row note', () => {
  const html = renderHTML({ showEmpty: true });
  assert.match(html, /Boş parkları gizle/);
  assert.doesNotMatch(html, /gizlendi — yalnız sorgulanmışlar/);
});

test('empty park table retains its create-park empty state', () => {
  const element = { innerHTML: '' };
  render({ element, rows: [], overview: { projByPark: {}, measByPark: {}, emptyRows: [], shown: [], dupGroups: [], unnamed: [] }, showEmpty: false, formatHectares: () => '', distance: () => 0, escapeHTML, translate: x => x, translateFormat: fmt, translatePlain: x => x });
  assert.match(element.innerHTML, /Henüz park kimliği yok/);
});
