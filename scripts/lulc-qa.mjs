#!/usr/bin/env node
/* lulc-qa.mjs — Arazi örtüsü analizini TARAYICI DIŞINDA yeniden üretir.
 *
 * Neden: landcover.js'teki boru hattı (STAC → SAS → COG → UTM → hücre kesişimi)
 * yalnızca tarayıcıda çalışıyordu ve "QA başarısız: %99.61 fark" gibi hataların
 * kökü görülemiyordu. Bu araç aynı fonksiyonları Node'da, GERÇEK veriyle
 * çalıştırıp her ara değeri döker:
 *
 *   node scripts/lulc-qa.mjs --park "Göksu Parkı"          (Overpass'ten polygon)
 *   node scripts/lulc-qa.mjs --lat 39.96 --lon 32.68 --r 400  (daire yaklaşık AOI)
 *
 * Çıktı: item id, EPSG, COG meta (minX/maxY/dx/dy), park UTM bbox, okuma
 * penceresi, hücre sayısı, assigned/park alan farkı ve sınıf alanları (ha).
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/* ---------- argümanlar ---------- */
const arg = (ad) => {
  const i = process.argv.indexOf('--' + ad);
  return i >= 0 ? process.argv[i + 1] : null;
};
const PARK = arg('park');
const LAT = Number(arg('lat')), LON = Number(arg('lon')), R = Number(arg('r') || 400);

/* ---------- park polygonu ---------- */
async function nominatim(ad) {
  const u = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=' +
    encodeURIComponent(ad + ', Türkiye');
  const r = await fetch(u, { headers: { 'User-Agent': 'dendrogeo-lulc-qa/1.0' } });
  if (!r.ok) throw new Error('Nominatim HTTP ' + r.status);
  const j = await r.json();
  if (!j.length) throw new Error(`Nominatim "${ad}" bulamadı`);
  return { lat: Number(j[0].lat), lon: Number(j[0].lon), ad: j[0].display_name.slice(0, 60) };
}

async function overpassPark(ad) {
  const c = await nominatim(ad);
  console.log(`   Nominatim: ${c.ad} → ${c.lat.toFixed(5)}, ${c.lon.toFixed(5)}`);
  const q = `[out:json][timeout:60];
    nwr["leisure"="park"]["name"~"${ad}",i](around:4000,${c.lat},${c.lon});
    out geom;`;
  const AYNALAR = [
    'https://overpass.private.coffee/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass-api.de/api/interpreter',
    'https://lz4.overpass-api.de/api/interpreter',
  ];
  let j = null, sonHata = null;
  for (const url of AYNALAR) {
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'dendrogeo-lulc-qa/1.0 (scientific QA tool)',
          'Accept': 'application/json',
        },
        body: 'data=' + encodeURIComponent(q),
        signal: AbortSignal.timeout(90000),
      });
      if (!r.ok) { sonHata = url + ' HTTP ' + r.status; continue; }
      j = await r.json();
      console.log(`   Overpass aynası: ${new URL(url).hostname}`);
      break;
    } catch (e) { sonHata = url + ' → ' + e.message; }
  }
  if (!j) throw new Error('Overpass erişilemedi: ' + sonHata);
  // en büyük halkayı seç (birden çok eşleşme olabilir)
  let enBuyuk = null, enBuyukAlan = -1;
  for (const el of j.elements || []) {
    let ring;
    if (el.type === 'way') ring = (el.geometry || []).map((g) => [g.lat, g.lon]);
    else {
      const outer = (el.members || []).filter((m) => m.role === 'outer' || m.role === '');
      ring = [];
      for (const m of outer) for (const g of m.geometry || []) ring.push([g.lat, g.lon]);
    }
    if (ring.length < 3) continue;
    let a = 0;
    for (let i = 0; i < ring.length; i++) {
      const p1 = ring[i], p2 = ring[(i + 1) % ring.length];
      a += p1[1] * p2[0] - p2[1] * p1[0];
    }
    a = Math.abs(a) / 2;
    if (a > enBuyukAlan) { enBuyukAlan = a; enBuyuk = { ring, meta: { osm: el.type + '/' + el.id, name: el.tags?.name } }; }
  }
  if (!enBuyuk) throw new Error(`Overpass "${ad}" için polygon bulamadı`);
  return enBuyuk;
}

function daireAOI(lat, lon, rM) {
  const ring = [];
  for (let i = 0; i < 64; i++) {
    const a = (2 * Math.PI * i) / 64;
    const dLat = (rM * Math.sin(a)) / 111320;
    const dLon = (rM * Math.cos(a)) / (111320 * Math.cos((lat * Math.PI) / 180));
    ring.push([lat + dLat, lon + dLon]);
  }
  return { ring, meta: { osm: 'daire', name: `r=${rM}m` } };
}

/* geotiff.js yüklenirken (zstd çözücü için) bir Worker ÖRNEĞİ oluşturur.
 * Node'da tarayıcı Worker'ı yok; DEFLATE/LERC çözümü ana iş parçacığında
 * yapıldığı için inşa edilip hiç kullanılmayan bir iskelet yeterli.
 * Gerçek bir worker gerekirse shim yüksek sesle patlar — sessiz yanlış
 * sonuç üretmez. */
function shimIsci(ctx) {
  ctx.Worker = class WorkerShim {
    constructor(url) { this.url = String(url); }
    postMessage() { throw new Error('QA: geotiff worker tabanlı çözüm denedi (zstd?) — beklenmeyen yol'); }
    terminate() {}
    addEventListener() {}
    removeEventListener() {}
  };
  if (!ctx.URL.createObjectURL) ctx.URL.createObjectURL = () => 'blob:qa-fake';
  ctx.Blob = ctx.Blob || class { constructor() {} };
}

/* ---------- vm bağlamı: gerçek fetch + vendor GeoTIFF ---------- */
function baglam() {
  const ctx = {
    console, fetch, setTimeout, clearTimeout, URL, URLSearchParams,
    Map, Set, Math, JSON, Date, Number, Array, Object, String, Boolean,
    Promise, RegExp, Error, Intl, isNaN, parseInt, parseFloat,
    ArrayBuffer, Uint8Array, Uint16Array, Int32Array, Float32Array,
    Float64Array, DataView, TextDecoder, TextEncoder, AbortController,
    Response, Headers, Request, Buffer,
    window: null, document: { createElement: () => ({}) },
    navigator: { userAgent: 'node-qa' }, location: { origin: 'https://qa.local' },
  };
  shimIsci(ctx);
  ctx.window = ctx;
  ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(readFileSync(join(ROOT, 'vendor/geotiff-2.1.3.js'), 'utf8'), ctx, { filename: 'geotiff.js' });
  vm.runInContext(readFileSync(join(ROOT, 'src/services/landcover.js'), 'utf8'), ctx, { filename: 'landcover.js' });
  vm.runInContext('this.__api={dgLcFindTiles,dgLcGetSas,dgLcGetDataAsset,dgLcSignedHref,dgLcProcessTile,' +
    'dgLcMergeTileResults,dgLcProjectGeometry,dgLcProjectedArea,dgLcBboxFromGeometry,' +
    'dgLcUtmEpsgFromItem,dgLcUtmEpsgForLatLon,dgLcUtmForward,dgLcImageMeta,dgLcWindowForPark,' +
    'DG_LC_CLASSES,dgLcReportClassForCode};', ctx);
  return ctx.__api;
}

function shoelaceHa(ring) {
  let s = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    // yaklaşık: derece→metre yerel düzlem
    const kx = 111320 * Math.cos((ring[0][0] * Math.PI) / 180), ky = 110540;
    s += (a[1] * kx) * (b[0] * ky) - (b[1] * kx) * (a[0] * ky);
  }
  return Math.abs(s) / 2 / 10000;
}

/* ---------- ana akış ---------- */
const src = PARK ? await overpassPark(PARK) : daireAOI(LAT, LON, R);
console.log(`\n🌳 AOI: ${src.meta.name} (${src.meta.osm}) · ${src.ring.length} köşe · yaklaşık ${shoelaceHa(src.ring).toFixed(2)} ha`);

const api = baglam();
const outer = [src.ring], holes = [];
const bbox = api.dgLcBboxFromGeometry(outer, holes);
console.log(`   WGS84 bbox: [${bbox.minLon.toFixed(5)}, ${bbox.minLat.toFixed(5)} → ${bbox.maxLon.toFixed(5)}, ${bbox.maxLat.toFixed(5)}]`);

const items = await api.dgLcFindTiles(bbox);
console.log(`\n🛰  STAC item sayısı: ${items.length}`);
const token = await api.dgLcGetSas();
console.log(`   SAS token: ${token ? 'alındı (' + token.length + ' krk)' : 'YOK (açık asset denenecek)'}`);

// vm bağlamını bir kez kur ve TÜM analizi vm içinde yürüt (GeoTIFF orada yüklü)
const ctx2 = (() => {
  const ctx = {
    console, fetch, setTimeout, clearTimeout, URL, URLSearchParams,
    Map, Set, Math, JSON, Date, Number, Array, Object, String, Boolean,
    Promise, RegExp, Error, Intl, isNaN, parseInt, parseFloat,
    ArrayBuffer, Uint8Array, Uint16Array, Int32Array, Float32Array,
    Float64Array, DataView, TextDecoder, TextEncoder, AbortController,
    Response, Headers, Request, Buffer,
    window: null, document: { createElement: () => ({}) },
    navigator: { userAgent: 'node-qa' }, location: { origin: 'https://qa.local' },
  };
  shimIsci(ctx);
  ctx.window = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(readFileSync(join(ROOT, 'vendor/geotiff-2.1.3.js'), 'utf8'), ctx, { filename: 'geotiff.js' });
  vm.runInContext(readFileSync(join(ROOT, 'src/services/landcover.js'), 'utf8'), ctx, { filename: 'landcover.js' });
  return ctx;
})();

const script = `
(async () => {
  const outer = ${JSON.stringify(outer)}, holes = ${JSON.stringify(holes)};
  const bbox = dgLcBboxFromGeometry(outer, holes);
  const items = await dgLcFindTiles(bbox);
  const token = await dgLcGetSas();
  const out = { items: [], merge: null };
  for (const item of items) {
    const asset = dgLcGetDataAsset(item);
    const href = dgLcSignedHref(asset.href, token);
    const tiff = await GeoTIFF.fromUrl(href);
    const image = await tiff.getImage();
    const keys = typeof image.getGeoKeys === 'function' ? image.getGeoKeys() : null;
    const epsgItem = dgLcUtmEpsgFromItem(item, keys);
    const epsgFall = dgLcUtmEpsgForLatLon(outer[0][0][0], outer[0][0][1]);
    const epsg = epsgItem || epsgFall;
    const geometry = dgLcProjectGeometry(outer, holes, epsg);
    const parkAreaNative = dgLcProjectedArea(geometry);
    const meta = dgLcImageMeta(image);
    const parkBBox = geometry.outer.reduce((acc, r) => {
      acc.minX = Math.min(acc.minX, r._bbox.minX); acc.minY = Math.min(acc.minY, r._bbox.minY);
      acc.maxX = Math.max(acc.maxX, r._bbox.maxX); acc.maxY = Math.max(acc.maxY, r._bbox.maxY);
      return acc;
    }, { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
    let win = null, winErr = null;
    try { win = dgLcWindowForPark(meta, parkBBox); } catch (e) { winErr = e.message; }
    out.items.push({
      id: item.id,
      epsgItem, epsgFall, epsgKullanilan: epsg,
      geoKeys: keys ? { ProjectedCSTypeGeoKey: keys.ProjectedCSTypeGeoKey, PCS: keys.PCSCitationGeoKey } : null,
      meta, parkBBox, parkAreaNative, win, winErr,
      tiepoint: typeof image.getTiePoints === 'function' ? image.getTiePoints().slice(0, 1) : null,
      origin: typeof image.getOrigin === 'function' ? await image.getOrigin() : null,
    });
    if (win) {
      const part = await dgLcProcessTile(item, href, { outer, holes });
      const siniflar = {};
      for (const cls of DG_LC_CLASSES) {
        const alan = cls.codes.reduce((t, c) => t + ((part.rawAreas || part.areas || {})[c] || 0), 0);
        const adet = cls.codes.reduce((t, c) => t + ((part.rawCounts || part.counts || {})[c] || 0), 0);
        siniflar[cls.key] = { ha: +(alan / 10000).toFixed(2), hucre: adet };
      }
      const kodDetay = {};
      const rc = part.rawCounts || part.counts || {};
      const ra = part.rawAreas || part.areas || {};
      for (const c of Object.keys(rc)) {
        if (rc[c] > 0) kodDetay[c] = { hucre: rc[c], ha: +(ra[c] / 10000).toFixed(2) };
      }
      out.items[out.items.length - 1].part = {
        sourceCells: part.sourceCells,
        assigned: part.assignedAreaM2,
        classified: part.classifiedAreaM2,
        masked: part.maskedAreaM2,
        siniflar, kodDetay,
      };
    }
  }
  return out;
})()
`;

const res = await vm.runInContext(script, ctx2, { filename: 'qa-analiz.js' });
for (const it of res.items) {
  console.log(`\n── item ${it.id}`);
  console.log(`   EPSG: item=${it.epsgItem} fallback=${it.epsgFall} → kullanılan=${it.epsgKullanilan}`);
  console.log(`   COG meta : minX=${it.meta.minX.toFixed(1)} maxX=${it.meta.maxX.toFixed(1)} minY=${it.meta.minY.toFixed(1)} maxY=${it.meta.maxY.toFixed(1)} ${it.meta.width}x${it.meta.height} dx=${it.meta.dx} dy=${it.meta.dy}`);
  console.log(`   park UTM : minX=${it.parkBBox.minX.toFixed(1)} maxX=${it.parkBBox.maxX.toFixed(1)} minY=${it.parkBBox.minY.toFixed(1)} maxY=${it.parkBBox.maxY.toFixed(1)}`);
  console.log(`   park alanı (UTM shoelace): ${(it.parkAreaNative / 10000).toFixed(2)} ha`);
  console.log(`   pencere  : ${it.win ? it.win.join(',') : 'HATA: ' + it.winErr}`);
  if (it.part) {
    console.log(`   hücre=${it.part.sourceCells} assigned=${(it.part.assigned / 10000).toFixed(2)} ha classified=${(it.part.classified / 10000).toFixed(2)} ha masked=${(it.part.masked / 10000).toFixed(2)} ha`);
    console.log(`   SINIFLAR: ` + Object.entries(it.part.siniflar).map(([k, v]) => `${k}=${v.ha}ha`).join(' · '));
    console.log(`   ham kodlar: ` + JSON.stringify(it.part.kodDetay));
  }
}
console.log('');
/* ---------- UÇTAN UCA: dgLcAnalyze (çift kaynak + nesneler) ---------- */
const analyzeScript = `
(async () => {
  const outer = ${JSON.stringify(outer)}, holes = [];
  const geom = dgLcProjectGeometry(outer, holes, 32636);
  const parkAreaM2 = dgLcProjectedArea(geom);
  const rep = await dgLcAnalyze({ outer, holes, parkAreaM2 });
  const last = window.DG_LANDCOVER.getLast();
  return { parkAreaM2, rep, runs: last.result.runs.length, cells: last.result.cells.length };
})()
`;
console.log('\n════════ UÇTAN UCA ANALİZ (dgLcAnalyze) ════════');
try {
  const { parkAreaM2, rep, runs, cells } = await vm.runInContext(analyzeScript, ctx2, { filename: 'qa-analyze.js' });
  console.log(`  görsel katman: ${runs} run bandı · ${cells} hücre (render limiti şu an 2500)`);
  console.log(`  park polygonu : ${(parkAreaM2 / 10000).toFixed(2)} ha`);
  console.log(`  analiz alanı  : ${(rep.rasterCoverageAreaM2 / 10000).toFixed(2)} ha  (QA farkı %${rep.areaDeltaPct.toFixed(3)})`);
  console.log(`  kaynak        : ${rep.primaryLabel} · karolar: ${rep.primaryItems.join(', ')}`);
  console.log('');
  console.log('  SINIFLAR (ana kaynak):');
  for (const [k, v] of Object.entries(rep.classes)) {
    if (!v.count && !v.areaHa) continue;
    console.log(`    ${v.emoji} ${v.label.padEnd(14)} ${String(v.count).padStart(5)} hücre  ${v.areaHa.toFixed(2).padStart(7)} ha  %${v.pct.toFixed(1)}`);
  }
  if (rep.agreement) {
    console.log('');
    console.log('  ÇAPRAZ DOĞRULAMA (' + rep.crossLabel + '):');
    for (const [k, a] of Object.entries(rep.agreement)) {
      if (!a.primaryHa && !a.crossHa) continue;
      console.log(`    ${k.padEnd(6)} ana=${a.primaryHa.toFixed(2).padStart(7)} ha  çapraz=${a.crossHa.toFixed(2).padStart(7)} ha  uzlaşma=%${a.agreementPct.toFixed(0)}`);
    }
  } else {
    console.log('  çapraz doğrulama YOK:', rep.crossError);
  }
  if (rep.patches && rep.patches.length) {
    console.log('');
    console.log('  NESNELER (bağlantılı bileşenler ≥0,05 ha):');
    for (const pt of rep.patches.slice(0, 10)) {
      console.log(`    ${pt.group.padEnd(6)} ${pt.areaHa.toFixed(2).padStart(7)} ha  ${String(pt.cells).padStart(5)} hücre  merkez(${pt.centroidLat.toFixed(5)}, ${pt.centroidLon.toFixed(5)})`);
    }
  }
} catch (e) {
  console.error('  ❌ ANALİZ HATASI:', e.message);
  process.exitCode = 1;
}
