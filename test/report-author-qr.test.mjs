/* report-author-qr.test.mjs — 0012 sözleşmeleri (2026-09-28 kullanıcı standardı)
 *
 * Kilitlenen davranışlar:
 *  1) YAZAR = yayını isteyen kullanıcı (snap.author); kurucular contributors.
 *     Ad çözülemezse kurumsal yazar — İSİM UYDURULMAZ.
 *  2) citeName atıf biçimi: "Ad Soyad" → "Soyad, A."
 *  3) QR: kalıcı adres data-URI SVG olarak künyede gömülü (dış istek yok).
 *  4) metadata.json: creators (istek sahibi) + contributors (kurucular) +
 *     creatorsNote; DataCite 4.7 alan adları korunur.
 *  5) Sıkı arşiv: publishPark data.json/metadata.json'u minified yazar
 *     (kaynak düzeyinde kilit; donmuş raporlar değişmez).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalHash, MC_CFG } from '../scripts/lib/mc.mjs';
import { renderReport, buildMetadata, citeName, qrDataUri, FOUNDERS_LINE } from '../scripts/make-report.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

const base = {
  schema: 'dendrogeo-report/1',
  park: { id: 25, name: 'Göksu Parkı', osm_key: 'way/423602737', city: 'Ankara', country: 'Türkiye', area_m2: 501107 },
  generated_at: '2026-09-28T12:00:00.000Z',
  mc: { ...MC_CFG },
  totals: { n: 2, carbon_kg: 400, ci: { mean: 400, lo: 300, hi: 500 }, per_ha_kg: 80 },
  species: [{ species: 'KARAÇAM', grp: 'İBRELİ', n: 2, mean_dbh: 34, mean_h: 12, carbon_kg: 400, share_pct: 100 }],
  gps: { n: 2, n_with_acc: 2, n_null_acc: 0, mean_acc_m: 4.2 },
  period: { from: '2026-09-28T09:00:00Z', to: '2026-09-28T15:00:00Z' },
  moderation: { approved: 2, reviewed: 2 },
  geofence: { policy: 'x', total: 2, verified_rows: 2, outside_rows: 0, polygon_source: 'OSM' },
  geometry_qa: { source: 'OSM way/423602737', ring_points: 111, ring_area_m2: 500000, self_intersections: 0, geom_json_bbox_ignored: null },
  provenance: { engine: 'DendroGeo LC Engine', engine_version: '4.2.0', app_version: '3.0.0', git_commit: 'abc1234', report_id: 'DGR-2026-9001', epsg: null, resolution_m: 10, dataset: 'ESA WorldCover 10 m · 2021 (v200)' },
  lulc: null,
  rows: [
    { id: 1, point_id: 7, species: 'KARAÇAM', grp: 'İBRELİ', dbh_cm: 34.06, girth_cm: 107, height_m: 12, carbon_kg: 211.2, volume_m3: 0.55, lat: 39.99, lon: 32.65, acc_m: 4.2, photo: true, date: '2026-09-28' },
    { id: 2, point_id: 29, species: 'IHLAMUR', grp: 'YAPRAKLI', dbh_cm: 12.73, girth_cm: 40, height_m: 4.5, carbon_kg: 10.6, volume_m3: 0.03, lat: 39.99, lon: 32.65, acc_m: 4.2, photo: true, date: '2026-09-28' },
  ],
};
const render = (snap, id = 'DGR-2026-9001') =>
  renderReport(snap, { id, hash: canonicalHash(snap), version: 1, meta: { id, history: [] } });

describe('0012 · citeName atıf biçimi', () => {
  test('"Ad Soyad" → "Soyad, A." (DataCite/APA adı-soyadı düzeni)', () => {
    assert.equal(citeName('Nagihan Şirin'), 'Şirin, N.');
    assert.equal(citeName('Ahmet Yılmaz Kaya'), 'Kaya, A.');
    assert.equal(citeName('  çok   boşluklu  ad '), 'ad, ç.');
  });
  test('tek ad ve virgüllü ad olduğu gibi kalır; boş → null', () => {
    assert.equal(citeName('Platon'), 'Platon');
    assert.equal(citeName('Şirin, Nagihan'), 'Şirin, Nagihan');
    assert.equal(citeName(''), null);
    assert.equal(citeName(null), null);
  });
});

describe('0012 · yazar = yayını isteyen kullanıcı', () => {
  test('snap.author künyede, atıfta, BibTeX ve JSON-LD de', () => {
    const snap = { ...base, author: { name: 'Nagihan Şirin', source: 'report_request' } };
    const html = render(snap);
    assert.match(html, /<b>Yazar<\/b><code>Nagihan Şirin<\/code>/, 'künye yazarı');
    assert.ok(html.includes(FOUNDERS_LINE), 'kurucular beyanı künyede');
    assert.match(html, /Şirin, N\. \(\d{4}\)\. Göksu Parkı ağaç envanteri/, 'önerilen atıf yazarla');
    assert.match(html, /author\s*=\s*\{Şirin, N\.\}/, 'BibTeX author');
    assert.match(html, /contributor = \{Şirin, Nagihan and Şirin, Sinan\}/, 'BibTeX contributor kurucular');
    const ld = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
    assert.deepEqual(ld.author, [{ '@type': 'Person', name: 'Nagihan Şirin' }]);
    assert.equal(ld.contributor.length, 2, 'JSON-LD contributor = kurucular');
  });

  test('ad çözülemezse kurumsal yazar — İSİM UYDURULMAZ', () => {
    const snap = { ...base, author: { name: null, source: 'unavailable', note: 'view yok' } };
    const html = render(snap);
    assert.match(html, /DendroGeo \(kurumsal\)/, 'künyede kurumsal yazar');
    assert.ok(!html.includes('<b>Yazar</b><code>Şirin'), 'kurucu adı yazar olarak GEÇMEZ');
    assert.match(html, /istek sahibi adı çözülemedi/, 'dürüst beyan');
    const ld = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
    assert.deepEqual(ld.author, [{ '@type': 'Organization', name: 'DendroGeo' }]);
  });

  test('metadata.json: creators istek sahibi, contributors kurucular (DataCite 4.7)', () => {
    const snap = { ...base, author: { name: 'Nagihan Şirin', source: 'report_request' } };
    const md = buildMetadata(snap, { id: 'DGR-2026-9001', hash: canonicalHash(snap), version: '1.0', meta: {}, history: [] });
    assert.deepEqual(md.creators, [{ name: 'Şirin, N.', nameType: 'Personal' }]);
    assert.equal(md.contributors.length, 2);
    assert.equal(md.contributors[0].contributorType, 'Founder');
    assert.match(md.creatorsNote, /yayını isteyen kullanıcının/);
    assert.equal(md.resourceTypeGeneral, 'Report', 'DataCite 4.7 alanı korunur');
    assert.equal(md.doi, null, 'DOI atanmadı beyanı');
  });

  test('author alanı hiç yoksa (eski snapshot) da çökmez', () => {
    const snap = { ...base };
    delete snap.author;
    const html = render(snap);
    assert.match(html, /DendroGeo \(kurumsal\)/);
  });
});

/* qrcode kurulu değilse (npm install çalışmamış ortam) QR testleri ATLANIR:
 * QR kozmetiktir, rapor üretimi onsuz da geçerlidir (zarif fallback).
 * CI'da `npm ci` adımı kurar → orada bu testler KOŞAR. */
const HAS_QR = (() => { try { createRequire(import.meta.url)('qrcode'); return true; } catch (e) { return false; } })();
const qrSkip = HAS_QR ? false : 'qrcode kurulu değil (npm ci sonrası koşar)';

describe('0027 · rapor PDF/print dostu', () => {
  test('print bloğu: kaydırma kapları kağıtta kırpılmaz, tam genişlik basılır', () => {
    const snap = { ...base, author: { name: 'Nagihan Şirin', source: 'data_owner' } };
    const html = render(snap);
    assert.match(html, /@page\{margin:14mm\}/, 'sayfa kenar boşluğu');
    assert.match(html, /\.tscroll\{overflow:visible!important/, 'kaplar print’te görünür (kırpma yok)');
    assert.match(html, /print-color-adjust:exact/, '0028: kullanıcı arka planları kapatsa bile renkler basılır');
    assert.match(html, /\.fig img\{max-width:100%!important;max-height:182mm/, '0028: harita tek sayfaya sığar (boş sayfa yok)');
    assert.match(html, /\.grp\{display:inline-flex/, '0028: grup rozeti + ad aynı satırda');
    assert.match(html, /<span class="grp">/, '0028: tür tablosunda grup hücresi sarılı');
    assert.match(html, /table\{min-width:0!important/, 'tablo kağıt genişliğine iner');
    assert.match(html, /\.btnrow,\.verify button\{display:none!important\}/, 'düğmeler basılmaz');
    assert.match(html, /\.fig\{break-inside:avoid;page-break-inside:avoid\}/, 'Şekil 1/2 sayfayı bölmez');
    assert.match(html, /tr\{break-inside:avoid\}/, 'satırlar bölünmez');
    assert.match(html, /window\.print\(\)/, '🖨 düğmesi yerinde');
  });
});

describe('0015 · yazar = veri sahibi (öncelik zinciri)', () => {
  test('SQL: SECURITY DEFINER fonksiyon yalnız ad döndürür (e-posta SIZMAZ)', () => {
    const sql = read('supabase/migrations/0015_report_data_owner.sql');
    assert.match(sql, /create or replace function public\.dg_park_author/);
    assert.match(sql, /security definer/);
    assert.match(sql, /returns table\(full_name text, organization text\)/, 'yalnız iki alan');
    assert.ok(!/p\.email/.test(sql), 'e-posta sızıntısı yok');
    assert.match(sql, /count\(\*\) desc/, 'en çok katkı veren sahip');
    assert.match(sql, /grant execute on function public\.dg_park_author\(bigint\) to anon, authenticated/);
  });
  test('motor: önce rpc/dg_park_author, sonra v_report_authors (kod sözleşmesi)', () => {
    const src = read('scripts/make-report.mjs');
    const i1 = src.indexOf("rest('rpc/dg_park_author'");
    const i2 = src.indexOf("rest('v_report_authors'");
    assert.ok(i1 > 0 && i2 > i1, 'öncelik sırası: data_owner → report_request (i1=' + i1 + ' i2=' + i2 + ')');
    assert.match(src, /setName\(String\(pa\[0\]\.full_name\)\.trim\(\), 'data_owner'\)/, 'data_owner kaynağı');
  });
});

describe('0012 · QR kalıcı bağlantı (standart md. 15)', () => {
  test('qrDataUri geçerli data-URI SVG üretir', { skip: qrSkip }, async () => {
    const uri = await qrDataUri('https://dendrogeo.org/rapor/DGR-2026-9001/');
    assert.ok(uri && uri.startsWith('data:image/svg+xml;charset=utf-8,'), 'data-URI');
    const svg = decodeURIComponent(uri.slice(uri.indexOf(',') + 1));
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/, 'SVG biçimi');
    assert.ok(svg.includes('<path') || svg.includes('<rect'), 'QR modülleri çizili');
  });
  test('meta.qr_uri künyede basılır; dış istek YOK; uri yoksa adres metni kalır', { skip: qrSkip }, async () => {
    const snap = { ...base, author: { name: 'Nagihan Şirin', source: 'report_request' } };
    const uri = await qrDataUri('https://dendrogeo.org/rapor/DGR-2026-9001/');
    const html = renderReport(snap, { id: 'DGR-2026-9001', hash: canonicalHash(snap), version: 1, meta: { id: 'DGR-2026-9001', history: [], qr_uri: uri } });
    assert.match(html, /<b>Kalıcı bağlantı \(QR\)<\/b>/);
    assert.ok(html.includes('src="data:image/svg+xml;charset=utf-8,'), 'QR gömülü');
    assert.ok(!/src="https?:\/\/[^"]*qr/i.test(html), 'harici QR servisi YOK');
    assert.ok(html.includes('https://dendrogeo.org/rapor/DGR-2026-9001/'), 'kalıcı adres künyede');
    const html2 = render(snap);
    assert.match(html2, /<b>Kalıcı bağlantı<\/b><code>https:\/\/dendrogeo\.org\/rapor\/DGR-2026-9001\//, 'QR üretilemezse adres metni');
  });
});

describe('0024 · mobil düzen v2 (kaydırma kabı — 0021 display:block dersi)', () => {
  test('tablolar .tscroll kabında; tablo display:block DEĞİL (kolon kayması yok)', () => {
    const snap = { ...base, author: { name: 'Nagihan Şirin', source: 'data_owner' } };
    const html = render(snap);
    assert.match(html, /@media \(max-width:640px\)/, 'mobil kırılım');
    assert.match(html, /\.tscroll\{overflow-x:auto/, 'dar ekranda tablo kabı yatay kayar');
    assert.match(html, /table\{font-size:\.74rem;min-width:520px\}/, 'tablo normal düzen + asgari genişlik');
    assert.ok(!/table\{display:block/.test(html), '0021 hatası geri gelmesin: thead/tbody ayrı kutuya bölünmez');
    assert.ok(!/overflow-x:hidden/.test(html), '0021 hatası: hidden başlıkları kırpmasın');
    assert.match(html, /overflow-wrap:anywhere/, 'uzun kimlik/sayılar hücrede kırılır');
    /* QA + tür tablosu gerçekten kabın içinde */
    const qa = html.indexOf('<th>Kontrol</th>');
    assert.ok(html.lastIndexOf('<div class="tscroll">', qa) > qa - 400, 'QA tablosu tscroll içinde');
    const sp = html.indexOf('<th>Tür</th>');
    assert.ok(html.lastIndexOf('<div class="tscroll">', sp) > sp - 400, 'tür tablosu tscroll içinde');
    /* masaüstü + print bozulmadı */
    assert.match(html, /\.wrap\{max-width:860px/, 'masaüstü düzen');
    assert.match(html, /@media print\{/, 'print düzeni');
  });
});

describe('0012 · sıkı arşiv (minified JSON) + archive_bytes', () => {
  test('publishPark data.json/metadata.json sıkıştırılmış yazar', () => {
    const src = read('scripts/make-report.mjs');
    assert.match(src, /writeFileSync\(join\(out, 'data\.json'\), JSON\.stringify\(snap\)\)/, 'data.json minified');
    assert.match(src, /JSON\.stringify\(buildMetadata\([^)]*\)\) \+ '\\n'/, 'metadata.json minified');
    assert.ok(!/data\.json'\), JSON\.stringify\(snap, null, 2\)/.test(src), 'eski pretty yazım kalktı');
  });
  test('publish-queue arşiv boyutunu günlüğe yazar', () => {
    const src = read('scripts/publish-queue.mjs');
    assert.match(src, /archive_bytes/, 'günlük alanı');
    assert.match(src, /arşiv/, 'konsol özeti');
  });
});

describe('0012 · SQL migration dosyası', () => {
  const sql = read('supabase/migrations/0012_report_author.sql');
  test('v_report_authors: yalnız ad+organizasyon (e-posta YOK), anon grant, idempotent', () => {
    assert.match(sql, /create or replace view public\.v_report_authors/);
    assert.match(sql, /p\.full_name/);
    assert.match(sql, /p\.organization/);
    assert.ok(!/p\.email/.test(sql), 'e-posta sızdırılamaz');
    assert.match(sql, /grant select on public\.v_report_authors to anon, authenticated/);
    assert.match(sql, /^begin;/m);
    assert.match(sql, /^commit;/m);
  });
});
