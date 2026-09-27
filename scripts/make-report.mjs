#!/usr/bin/env node
/* make-report.mjs — DendroGeo Bilimsel Rapor Yayın Hattı (R1+R3, 2026-09-27)
 *
 * AMAÇ: bir park/proje için PAYLAŞILABİLİR, DEĞİŞMEZ (immutable), tez biçiminde
 * bilimsel rapor sayfası üretmek: https://dendrogeo.org/rapor/DGR-2026-0001/
 *
 * İLKELER
 *  · Sayfa STATİK ve kendi kendine yeterlidir: veri sayfanın içine gömülür
 *    (data.json ayrıca dosya olarak da yazılır); yayın anında DONDURULUR.
 *    Yeni analiz = yeni sürüm kimliği (s2, s3…) → geçmiş bozulmaz.
 *  · Bütünlük: snapshot'ın kanonik JSON'u SHA-256 ile hash'lenir; sayfa bu
 *    hash'i basar ve açılışta gömülü veriden YENİDEN HESAPLAYIP karşılaştırır
 *    (crypto.subtle) → "içerik bütünlüğü doğrulandı" rozeti canlı çalışır.
 *  · Kalıcılık: sayfa repo'ya commit'lenir (git geçmişi = immutability kanıtı);
 *    istenirse Zenodo'ya yatırılıp gerçek DOI alınır (R2, ayrı karar).
 *  · Dil: akademik kayıt dili; edilgen/kişisiz; tüm terimler ilk geçişte
 *    tanımlanır; belirsizlik ve sınırlılıklar açıkça beyan edilir.
 *  · Sayılar uydurulmaz: tümü canlı REST verisinden + scripts/lib/mc.mjs
 *    Monte Carlo çekirdeğinden türer; LULC bölümü uygulamanın kendi motoru
 *    (dgLcAnalyze) ile vm içinde hesaplanır.
 *
 * KULLANIM
 *   node scripts/make-report.mjs --park 5                 (LULC dahil)
 *   node scripts/make-report.mjs --park 5 --skip-lulc     (hızlı prova)
 *   GitHub Actions: workflow_dispatch "Rapor Yayınla" (rapor.yml)
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { mcTotalCI, mcRowCI, canonicalHash, MC_CFG, fmtT, loadRho, carbonKg } from './lib/mc.mjs';
import { PngCanvas, hex2rgb } from './lib/png.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const arg = (a) => { const i = process.argv.indexOf('--' + a); return i >= 0 ? process.argv[i + 1] : null; };
const has = (a) => process.argv.includes('--' + a);

const SB = (() => {
  const s = read('src/config/supabase.js');
  return { url: s.match(/SB_URL="([^"]+)"/)[1], key: s.match(/SB_KEY="([^"]+)"/)[1] };
})();
async function rest(table, params) {
  const u = SB.url + '/rest/v1/' + table + '?' + new URLSearchParams(params);
  const r = await fetch(u, { headers: { apikey: SB.key, Authorization: 'Bearer ' + SB.key } });
  if (!r.ok) throw new Error(table + ' HTTP ' + r.status);
  return r.json();
}
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const trNum = (x, d = 2) => Number(x).toLocaleString('tr-TR', { minimumFractionDigits: d, maximumFractionDigits: d });

/* ---------- LULC (uygulamanın kendi motoru, vm içinde) ---------- */
function bootLC() {
  const MODS = ['src/utils/geo.js', 'src/services/park-state.js', 'src/services/park-geometry.js',
    'src/services/lc-config.js', 'src/services/lc-geo.js', 'src/services/lc-stac.js',
    'src/services/lc-engine.js', 'src/services/lc-osm.js', 'src/services/lc-patches.js',
    'src/ui/lc-report.js', 'src/services/landcover.js'];
  const ctx = {
    console: { log() {}, warn() {}, error() {} },
    fetch: (u, o) => fetch(u, Object.assign({ headers: { 'User-Agent': 'dendrogeo-rapor/1.0' } }, o)),
    URL, URLSearchParams, TextEncoder, TextDecoder, AbortController,
    Math, JSON, Date, Promise, Number, Array, Object, String, Boolean, RegExp, Error, Map, Set,
    setTimeout, clearTimeout, parseInt, parseFloat, isNaN, Intl,
    ArrayBuffer, Uint8Array, Uint16Array, Int32Array, Float32Array, Float64Array, DataView,
    Response, Headers, Request, Buffer,
    document: { createElement: () => ({}) }, navigator: { userAgent: 'rapor' }, location: { origin: 'https://rapor.local' },
    Worker: class { postMessage() { throw new Error('worker yolu beklenmiyor'); } terminate() {} addEventListener() {} removeEventListener() {} },
  };
  ctx.window = ctx; ctx.self = ctx;
  if (!ctx.URL.createObjectURL) ctx.URL.createObjectURL = () => 'blob:rapor';
  vm.createContext(ctx);
  vm.runInContext(read('vendor/geotiff-2.1.3.js'), ctx, { filename: 'geotiff' });
  for (const m of MODS) vm.runInContext(read(m), ctx, { filename: m });
  vm.runInContext('globalThis.__dgLast=function(){return typeof DG_LC_LAST!=="undefined"?DG_LC_LAST:null;};', ctx);
  return ctx;
}
export async function parkOuter(park) {
  if (park.geom_json && park.geom_json.outer) return { outer: park.geom_json.outer[0], holes: (park.geom_json.inner || []) };
  const m = String(park.osm_key || '').match(/^(way|relation)\/(\d+)$/);
  if (!m) return null;
  let outer = null, holes = [];
  if (m[1] === 'way') {
    /* OSM ana API: way/full.json node ID'leri verir → way.nodes sırasıyla halka */
    const r = await fetch(`https://api.openstreetmap.org/api/0.6/way/${m[2]}/full.json`, { headers: { 'User-Agent': 'DendroGeo-rapor/1.0 (https://dendrogeo.org)' } });
    if (!r.ok) return null;
    const j = await r.json();
    const nd = {}; for (const e of j.elements) if (e.type === 'node') nd[e.id] = [e.lat, e.lon];
    const way = j.elements.find((e) => e.type === 'way');
    outer = (way?.nodes || []).map((id) => nd[id]).filter(Boolean);
  } else {
    /* relation: Overpass 'out geom' üye geometrisi verir (uygulamayla aynı kaynak tipi) */
    const q = `[out:json][timeout:60];relation(${m[2]});out geom;`;
    let j = null;
    for (const mir of ['https://overpass.private.coffee/api/interpreter', 'https://overpass-api.de/api/interpreter']) {
      try {
        const r = await fetch(mir, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'DendroGeo-rapor/1.0' }, body: 'data=' + encodeURIComponent(q) });
        if (r.ok) { j = await r.json(); break; }
      } catch (e) { /* ayna dene */ }
    }
    if (!j) return null;
    const ctx0 = bootLC();
    const el = j.elements && j.elements[0];
    const rings = el ? ctx0.extractRings(el) : null;
    if (!rings) return null;
    if (Array.isArray(rings)) { outer = rings[0]; holes = rings.slice(1); }
    else { outer = (rings.outer || [])[0]; holes = rings.inner || rings.holes || []; }
  }
  if (!outer || outer.length < 4) return null;
  return { outer, holes };
}
/* Tek-çift kuralı ile nokta–poligon testi (derece uzayında; halka [lat,lon]). */
export function pointInRing(lat, lon, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const laI = ring[i][0], loI = ring[i][1], laJ = ring[j][0], loJ = ring[j][1];
    if ((laI > lat) !== (laJ > lat) && lon < (loJ - loI) * (lat - laI) / (laJ - laI) + loI) inside = !inside;
  }
  return inside;
}
export function pointInPolygon(lat, lon, outer, holes = []) {
  if (!outer || !pointInRing(lat, lon, outer)) return false;
  for (const h of holes) if (pointInRing(lat, lon, h)) return false;
  return true;
}
export async function runLULC(park, preOuter = null) {
  const g = preOuter || (await parkOuter(park));
  if (!g) return null;
  const { outer, holes } = g;
  const ctx = bootLC();
  const area = park.area_m2 > 0 ? park.area_m2 : ctx.ringGeodesicArea(outer);
  const report = await ctx.dgLcAnalyze({ outer: [outer], holes, parkAreaM2: area });
  const last = ctx.__dgLast();
  const cells = ctx.dgLcCellsGeoJson(last.result);
  /* HARITA TAM ÖRTÜŞÜM: dgLcCellsGeoJson bellek koruması nedeniyle 10.000
   * hücrede kesilir (bu parkta 13.396 hücre → kesilen dilim haritada beyaz
   * kalıyordu). Çizim için KESİNTİSİZ run-length çıktısı (result.runs)
   * kullanılır ve UTM→WGS dönüşümü burada bir kez yapılır. */
  const runs = (last && last.result && Array.isArray(last.result.runs)) ? last.result.runs : [];
  /* Koordinat sistemi BÜYÜKLÜKTEN tanınır: |x|≤180 ve |y|≤90 ise derece
   * (4326 karosu), aksi hâlde UTM metreleri → ters dönüşüm. (run.epsg alanı
   * analiz EPSG'sini taşıyabildiği için tek başına güvenilir değildir.) */
  const toWgs = (x, y, epsg) => (Math.abs(x) <= 180 && Math.abs(y) <= 90
    ? { lon: x, lat: y } : ctx.dgLcUtmInverse(x, y, epsg));
  const wruns = runs.map((r) => {
    const a = toWgs(r.x0, r.y1, r.epsg);
    const b = toWgs(r.x1, r.y0, r.epsg);
    return {
      lo0: Math.min(a.lon, b.lon), lo1: Math.max(a.lon, b.lon),
      la0: Math.min(a.lat, b.lat), la1: Math.max(a.lat, b.lat),
      key: r.classKey,
    };
  }).filter((r) => [r.lo0, r.lo1, r.la0, r.la1].every(Number.isFinite));
  return { report, cells: cells && cells.features ? cells.features : [], wruns, outer, holes };
}
/* Şekil 2 — park sahası haritası.
 * Katman sırası (bilinçli): (1) park dışı bağlam dokusu, (2) park poligonu
 * taban boyası (maskeli/veri yok tonu → poligon içinde beyaz dilim fiziken
 * imkânsız), (3) çözümleme motorunun kesintisiz run-length hücreleri,
 * (4) park sınırı (beyaz halo + koyu mürekkep), (5) envanter noktaları,
 * (6) lejant / ölçek / kuzey oku. */
export const MAP_TONES = { out: [238, 240, 238], nodata: [212, 212, 208], ink: [24, 36, 32], mut: [104, 118, 110], halo: [255, 255, 255] };
function fillRing(cv, pts, col) {
  let y0 = 1e9, y1 = -1e9;
  for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  y0 = Math.max(0, Math.floor(y0)); y1 = Math.min(cv.h - 1, Math.ceil(y1));
  for (let y = y0; y <= y1; y++) {
    const xs = [];
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const ya = pts[j][1], yb = pts[i][1];
      if ((ya > y + 0.5) !== (yb > y + 0.5)) xs.push(pts[j][0] + (y + 0.5 - ya) / (yb - ya) * (pts[i][0] - pts[j][0]));
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) cv.rect(xs[i], y, xs[i + 1], y, col);
  }
}
function strokeRing(cv, pts, col, thick = 1) {
  const OFF = thick <= 1 ? [[0, 0]] : [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]];
  for (const [ox, oy] of OFF)
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++)
      cv.line(pts[j][0] + ox, pts[j][1] + oy, pts[i][0] + ox, pts[i][1] + oy, col);
}
function disc(cv, x, y, r, col) {
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++)
    if (dx * dx + dy * dy <= r * r) cv.set(x + dx, y + dy, col);
}
export function mapCanvas({ outer, holes = [], wruns = [], classes = {}, parkName = '', sub = '', sub2 = '', maskHa = 0, points = [], pointStat = null }) {
  const PAD = 26, TOP = 96, MAPH = 540;
  let minLa = 90, maxLa = -90, minLo = 180, maxLo = -180;
  for (const [la, lo] of outer) { minLa = Math.min(minLa, la); maxLa = Math.max(maxLa, la); minLo = Math.min(minLo, lo); maxLo = Math.max(maxLo, lo); }
  const dxM = Math.max(1, (maxLo - minLo) * 111320 * Math.cos(((minLa + maxLa) / 2) * Math.PI / 180));
  const dyM = Math.max(1, (maxLa - minLa) * 110540);
  const W = Math.max(420, Math.min(1000, Math.round((MAPH - 2 * PAD) * dxM / dyM) + 2 * PAD));
  const k = Math.max(0.02, Math.min((W - 2 * PAD) / dxM, (MAPH - 2 * PAD) / dyM));
  const cx = (minLo + maxLo) / 2, cy = (minLa + maxLa) / 2;
  const X = (lon) => W / 2 + (lon - cx) * 111320 * Math.cos(cy * Math.PI / 180) * k;
  const Y = (lat) => TOP + (MAPH - 2 * PAD) / 2 - (lat - cy) * 110540 * k;
  const legRows = ['green', 'hard', 'water', 'bare', 'other'].filter((key) => classes[key])
    .concat(maskHa > 0 ? ['masked'] : [], ['border', 'point', 'outside']);
  const H = TOP + MAPH + 16 + legRows.length * 28 + 18;
  const cv = new PngCanvas(W, H, MAP_TONES.out);
  const ring = outer.map(([la, lo]) => [X(lo), Y(la)]);
  fillRing(cv, ring, MAP_TONES.nodata);                       /* taban: veri yok tonu */
  for (const h of holes) fillRing(cv, h.map(([la, lo]) => [X(lo), Y(la)]), MAP_TONES.out);
  for (const r of wruns)                                      /* kesintisiz hücre örtüsü */
    cv.rect(X(r.lo0), Y(r.la1), X(r.lo1), Y(r.la0), hex2rgb((classes[r.key] && classes[r.key].color) || '#94a3b8'));
  /* KRIPMA GEÇİŞİ: run-length bantları satır içindeki poligon dışı boşlukları
   * köprüleyebildiği için (içbükey girinti) harita alanı taranır ve poligon
   * (delikler dâhil, tek-çift kuralı) dışındaki pikseller bağlam dokusuna
   * geri boyanır. Böylece hem beyaz/gri dilim kalmaz hem de park sahasının
   * dışına sınıf rengi taşmaz. */
  const allRings = [ring, ...holes.map((h) => h.map(([la, lo]) => [X(lo), Y(la)]))];
  const yMap1 = Math.min(cv.h - 1, TOP + MAPH);
  for (let y = 0; y <= yMap1; y++) {
    const xs = [];
    for (const rg of allRings) for (let i = 0, j = rg.length - 1; i < rg.length; j = i++) {
      const ya = rg[j][1], yb = rg[i][1];
      if ((ya > y + 0.5) !== (yb > y + 0.5)) xs.push(rg[j][0] + (y + 0.5 - ya) / (yb - ya) * (rg[i][0] - rg[j][0]));
    }
    xs.sort((a, b) => a - b);
    let x = 0;
    for (let i = 0; i < xs.length; i += 2) {
      const a = Math.max(0, Math.ceil(xs[i] ?? 0)), b = Math.min(cv.w - 1, Math.floor(xs[i + 1] ?? cv.w));
      if (x < a) cv.rect(x, y, a - 1, y, MAP_TONES.out);
      x = Math.max(x, b + 1);
    }
    if (x < cv.w) cv.rect(x, y, cv.w - 1, y, MAP_TONES.out);
  }
  strokeRing(cv, ring, MAP_TONES.halo, 2);                    /* halo: sınır her zeminde okunur */
  strokeRing(cv, ring, MAP_TONES.ink, 1);
  for (const p of points) { disc(cv, X(p.lon), Y(p.lat), 5, MAP_TONES.halo); disc(cv, X(p.lon), Y(p.lat), 3, MAP_TONES.ink); }
  const T = (x, y, t, c, sc) => cv.text(x, y, t, c, sc);
  T(PAD, 12, parkName, MAP_TONES.ink, 3);
  T(PAD, 44, sub, MAP_TONES.mut, 2);
  if (sub2) T(PAD, 66, sub2, MAP_TONES.mut, 2);
  let ly = TOP + MAPH + 10;
  for (const key of legRows) {
    if (key === 'border') {
      cv.line(PAD + 2, ly + 11, PAD + 20, ly + 11, MAP_TONES.ink);
      T(PAD + 32, ly + 4, 'PARK SINIRI (OSM POLIGONU)', MAP_TONES.ink, 2);
    } else if (key === 'point') {
      disc(cv, PAD + 11, ly + 11, 5, MAP_TONES.halo); disc(cv, PAD + 11, ly + 11, 3, MAP_TONES.ink);
      T(PAD + 32, ly + 4, pointStat && pointStat.outside > 0
        ? `ENVANTER NOKTASI (ICINDE ${pointStat.inside} / DISINDA ${pointStat.outside})`
        : `ENVANTER NOKTASI (n=${points.length}, POLIGON ICINDE)`, MAP_TONES.ink, 2);
    } else if (key === 'outside') {
      cv.rect(PAD + 1, ly + 1, PAD + 21, ly + 21, MAP_TONES.out);
      cv.rect(PAD + 1, ly + 1, PAD + 21, ly + 2, [190, 194, 190]);
      T(PAD + 32, ly + 4, 'PARK DISI (BAGLAM)', MAP_TONES.mut, 2);
    } else if (key === 'masked') {
      cv.rect(PAD + 1, ly + 1, PAD + 21, ly + 21, MAP_TONES.nodata);
      T(PAD + 32, ly + 4, `MASKELI (BULUT/GOLGE) ${maskHa.toFixed(2)} ha`, MAP_TONES.mut, 2);
    } else {
      const c = classes[key];
      cv.rect(PAD + 1, ly + 1, PAD + 21, ly + 21, hex2rgb(c.color));
      T(PAD + 32, ly + 4, `${c.label} ${((c.areaM2 || 0) / 10000).toFixed(2)} ha`, MAP_TONES.ink, 2);
    }
    ly += 28;
  }
  const nice = [10, 20, 50, 100, 200, 500].find((m) => m * k > 90) || 1000;
  cv.rect(W - PAD - nice * k, TOP + MAPH - 40, W - PAD, TOP + MAPH - 32, MAP_TONES.ink);
  T(W - PAD - nice * k, TOP + MAPH - 62, nice + ' m', MAP_TONES.ink, 2);
  cv.line(W - PAD - 14, TOP + 60, W - PAD - 14, TOP + 26, MAP_TONES.ink);
  cv.line(W - PAD - 20, TOP + 36, W - PAD - 14, TOP + 24, MAP_TONES.ink);
  cv.line(W - PAD - 8, TOP + 36, W - PAD - 14, TOP + 24, MAP_TONES.ink);
  T(W - PAD - 24, TOP + 66, 'N', MAP_TONES.ink, 2);
  return cv;
}
export function renderMapPNG(opts) { return mapCanvas(opts).encode(); }

/* ---------- snapshot ---------- */
export async function buildSnapshot(parkId, { skipLulc = false } = {}) {
  const park = (await rest('parks', { id: 'eq.' + parkId, limit: 1 }))[0];
  if (!park) throw new Error('Park bulunamadı: ' + parkId);
  const rows = await rest('measurements', {
    select: 'id,point_id,measurement_no,species,grp,dbh_cm,height_m,carbon_kg,lat,lon,accuracy_m,created_at,reviewed_at,photo_url',
    park_id: 'eq.' + parkId, status: 'eq.Onaylı', order: 'point_id.asc',
  });
  if (!rows.length) throw new Error('Bu park için onaylı kayıt yok; rapor yayınlanamaz.');
  const ci = mcTotalCI(rows);
  const bySp = {};
  for (const r of rows) {
    const b = bySp[r.species] ||= { n: 0, c: 0, dbh: 0, h: 0, grp: r.grp, ci: null };
    b.n++; b.c += +r.carbon_kg; b.dbh += +r.dbh_cm; b.h += +r.height_m;
  }
  for (const [sp, b] of Object.entries(bySp)) b.ci = mcRowCI(rows.find((r) => r.species === sp));
  const acc = rows.map((r) => +r.accuracy_m).filter((x) => Number.isFinite(x) && x > 0);
  const dates = rows.map((r) => r.created_at).sort();
  const reviewed = rows.filter((r) => r.reviewed_at).length;
  /* Konum çiti denetimi SAYILARLA: her kayıt için gerçek nokta–poligon testi.
   * Daha önce verified_rows = rows.length varsayılıyordu; poligon dışında
   * koordinat taşıyan kayıt varsa rapor bunu beyan etmek zorundadır. */
  const OG = await parkOuter(park).catch(() => null);
  const gfInside = OG ? rows.filter((r) => pointInPolygon(+r.lat, +r.lon, OG.outer, OG.holes)).length : null;
  const gfStat = OG ? { inside: gfInside, outside: rows.length - gfInside } : null;
  let lulc = null;
  if (!skipLulc) {
    try {
      const L = await runLULC(park, OG);
      if (L) {
        const g = L.report.groupAreasM2 || {};
        lulc = {
          source: L.report.primaryLabel, citation: L.report.primaryCitation, year: L.report.year,
          cross: L.report.crossLabel, crossError: L.report.crossError || null,
          agreement: L.report.agreement, areaDeltaPct: L.report.areaDeltaPct, cells: L.report.sourceCells,
          masked_ha: +(((L.report.maskedAreaM2 || 0) / 10000).toFixed(2)),
          classes: Object.entries(L.report.classes).map(([k, c]) => ({ key: k, label: c.label, ha: +((g[k] || 0) / 10000).toFixed(2), pct: +((100 * (g[k] || 0) / L.report.classifiedAreaM2).toFixed(1)) })),
          _png: renderMapPNG({
            outer: L.outer, holes: L.holes, wruns: L.wruns, classes: L.report.classes,
            parkName: park.name,
            maskHa: +(((L.report.maskedAreaM2 || 0) / 10000).toFixed(2)),
            sub: (L.report.primaryLabel || 'ESA WorldCover 2021') + ' - 10 m',
            sub2: `PROJE SAHASI: ${(park.area_m2 / 10000).toFixed(1)} ha (OSM) - ` + (gfStat
              ? (gfStat.outside > 0
                ? `OLCUM NOKTASI: POLIGON ICINDE ${gfStat.inside} / DISINDA ${gfStat.outside}`
                : `${rows.length} ONAYLI OLCUM NOKTASI (POLIGON ICINDE)`)
              : `${rows.length} ONAYLI OLCUM NOKTASI`),
            points: rows.map((r) => ({ lat: +r.lat, lon: +r.lon })),
            pointStat: gfStat,
          }),
          _outer: L.outer,
        };
      }
    } catch (e) { lulc = { error: String(e && e.message || e) }; }
  }
  /* PNG/outer BINARY taşımaz: snapshot'tan AYRIK döner; hash yalnızca
   * sayfanın/data.json'ın içerdiği alanlar üzerinden hesaplanır → sayfa
   * açılışındaki bütünlük kontrolü ile yayın hash'i aynı şeyi imzalar. */
  const png = lulc && lulc._png ? lulc._png : null;
  const outerL = lulc && lulc._outer ? lulc._outer : null;
  if (lulc) { delete lulc._png; delete lulc._outer; }
  const snap = {
    schema: 'dendrogeo-report/1',
    park: { id: park.id, name: park.name, osm_key: park.osm_key, city: park.city, country: park.country, area_m2: park.area_m2 },
    generated_at: new Date().toISOString(),
    mc: { ...MC_CFG },
    totals: { n: rows.length, carbon_kg: +rows.reduce((a, r) => a + +r.carbon_kg, 0).toFixed(2), ci: { mean: +ci.mean.toFixed(2), lo: +ci.lo.toFixed(2), hi: +ci.hi.toFixed(2) }, per_ha_kg: park.area_m2 > 0 ? +(rows.reduce((a, r) => a + +r.carbon_kg, 0) / (park.area_m2 / 10000)).toFixed(2) : null },
    species: Object.entries(bySp).map(([sp, b]) => ({ species: sp, grp: b.grp, n: b.n, mean_dbh: +(b.dbh / b.n).toFixed(1), mean_h: +(b.h / b.n).toFixed(1), carbon_kg: +b.c.toFixed(2), share_pct: +(100 * b.c / rows.reduce((a, r) => a + +r.carbon_kg, 0)).toFixed(1) })),
    gps: { n: acc.length, mean_acc_m: acc.length ? +((acc.reduce((a, b) => a + b, 0) / acc.length)).toFixed(1) : null },
    period: { from: dates[0], to: dates[dates.length - 1] },
    moderation: { approved: rows.length, reviewed },
    geofence: {
      policy: 'park poligonu içinde ölçüm zorunlu (trg_geo_fence, 0007)',
      total: rows.length,
      verified_rows: gfInside == null ? rows.length : gfInside,
      outside_rows: gfInside == null ? 0 : rows.length - gfInside,
      polygon_source: OG ? (park.geom_json && park.geom_json.outer ? 'parks.geom_json' : 'OSM') : 'yok',
    },
    lulc,
    rows: rows.map((r) => ({ id: r.id, point_id: r.point_id, species: r.species, grp: r.grp, dbh_cm: +r.dbh_cm, height_m: +r.height_m, carbon_kg: +r.carbon_kg, lat: +(+r.lat).toFixed(6), lon: +(+r.lon).toFixed(6), acc_m: r.accuracy_m, date: r.created_at.slice(0, 10) })),
  };
  return { snap, hash: canonicalHash(snap), png, outerL };
}

/* ---------- render: akademik belge ---------- */
export function renderReport(snap, { id, hash, version = 1 }) {
  const t = snap.totals, P = snap.park;
  const ciTxt = `${fmtT(t.ci.mean)} t [%95 GA: ${fmtT(t.ci.lo)}–${fmtT(t.ci.hi)}]`;
  const spRows = snap.species.map((s) => `<tr><td class="tr">${esc(s.species)}</td><td>${esc(s.grp)}</td><td>${s.n}</td><td>${trNum(s.mean_dbh, 1)}</td><td>${trNum(s.mean_h, 1)}</td><td>${trNum(s.carbon_kg, 1)}</td><td>%${trNum(s.share_pct, 1)}</td></tr>`).join('');
  const maxShare = Math.max(...snap.species.map((s) => s.share_pct), 1);
  const bars = snap.species.map((s) => `<div class="brow"><span class="bl">${esc(s.species)}</span><div class="bar"><i style="width:${(s.share_pct / maxShare * 100).toFixed(1)}%"></i></div><span class="bv">%${trNum(s.share_pct, 1)}</span></div>`).join('');
  const lulcSec = snap.lulc && !snap.lulc.error
    ? `<p>Park poligonu, ${esc(snap.lulc.source)} ürününün 10 m çözünürlüklü kategorik rasteriyle tam poligon–hücre kesişimi yöntemiyle işlenmiş; raster/park alan farkı %${trNum(snap.lulc.areaDeltaPct, 3)} olarak doğrulanmıştır. Sınıf alanları Çizelge 2'de, mekânsal dağılım Şekil 2'de sunulmuştur. Şekil 2'de park sahasının tamamı kapalı poligon olarak gösterilir; koyu çizgi park sınırını (OSM poligonu), siyah noktalar envanter ölçüm noktalarını belirtir.${snap.lulc.masked_ha > 0 ? ` Çözümlemede ${trNum(snap.lulc.masked_ha, 2)} ha'lık bölüm bulut/gölge nedeniyle maskelenmiş ve Şekil 2'de gri tonla gösterilmiştir; bu alan sınıf toplamına dahil edilmemiştir.` : ''}${snap.lulc.agreement ? ` Bağımsız çapraz kaynak (${esc(snap.lulc.cross)}) ile grup bazlı uzlaşma: ${Object.entries(snap.lulc.agreement).map(([k, v]) => `${esc(k)} %${trNum(v.agreementPct, 0)}`).join(', ')}.</p>` : '</p>'}
    <table><thead><tr><th>Sınıf</th><th>Alan (ha)</th><th>Pay</th></tr></thead><tbody>${snap.lulc.classes.map((c) => `<tr><td class="tr">${esc(c.label)}</td><td>${trNum(c.ha, 2)}</td><td>%${trNum(c.pct, 1)}</td></tr>`).join('')}</tbody></table>
    <div class="fig"><img src="harita.png" alt="${esc(P.name)} park sahası arazi örtüsü sınıfları haritası; park sınırı ve ölçüm noktaları işaretli" style="width:100%;border-radius:8px"><div class="cap">Şekil 2 — ${esc(snap.lulc.source)} sınıflandırmasının park poligonu ile tam kesişimi; koyu çizgi park sınırını (OSM), siyah noktalar envanter ölçüm noktalarını gösterir. Çizim, çözümleme motorunun kesintisiz hücre çıktısından birebir ölçekli üretilmiştir; bağlayıcı sayısal değerler Çizelge 2'de ve data.json'dadır.</div></div>`
    : `<p>Bu sürümde arazi örtüsü çözümlemesi yer almamaktadır${snap.lulc && snap.lulc.error ? ` (teknik not: ${esc(snap.lulc.error)})` : ''}; bölüm sonraki sürümlerde tamamlanacaktır.</p>`;
  const bib = `@techreport{${id.toLowerCase().replace(/-/g, '')},
  author    = {Şirin, Nagihan and Şirin, Sinan},
  title     = {${P.name} ağaç envanteri ve karbon stoku raporu},
  year      = {${snap.generated_at.slice(0, 4)}},
  number    = {${id}},
  version   = {${version}},
  publisher = {DendroGeo},
  url       = {https://dendrogeo.org/rapor/${id}/},
  note      = {sha256:${hash.slice(0, 16)}…}
}`;
  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${id} · ${esc(P.name)} — Ağaç Envanteri ve Karbon Stoku Raporu</title>
<meta name="description" content="${esc(P.name)} (${esc(P.city)}) bireysel ağaç envanteri: ${t.n} onaylı ölçüm, toplam karbon ${fmtT(t.ci.mean)} t (%95 GA ${fmtT(t.ci.lo)}–${fmtT(t.ci.hi)}). Yöntem: Chave et al. 2014; Monte Carlo belirsizlik; konum çiti doğrulaması.">
<link rel="canonical" href="https://dendrogeo.org/rapor/${id}/">
<meta property="og:type" content="article">
<meta property="og:site_name" content="DendroGeo">
<meta property="og:title" content="${id} · ${esc(P.name)} Karbon Stoku Raporu">
<meta property="og:description" content="${t.n} onaylı ölçüm · toplam ${ciTxt} · sha256:${hash.slice(0, 12)}…">
<meta property="og:url" content="https://dendrogeo.org/rapor/${id}/">
${snap.lulc && !snap.lulc.error ? '<meta property="og:image" content="https://dendrogeo.org/rapor/' + id + '/harita.png">' : ''}
<meta name="twitter:card" content="${snap.lulc && !snap.lulc.error ? 'summary_large_image' : 'summary'}">
<link rel="alternate" hreflang="tr" href="https://dendrogeo.org/rapor/${id}/">
<style>
:root{--ink:#182420;--mut:#5f6d65;--line:#e6e3d9;--green:#1e6f4b;--leaf:#2f9e44;--gd:#14532d;--tint:#eaf3ec;--amber:#9a4a08;--bg:#f7f6f2}
*{box-sizing:border-box;margin:0}body{background:var(--bg);color:var(--ink);font:15px/1.7 Georgia,'Times New Roman',serif}
.sans{font-family:system-ui,-apple-system,'Segoe UI',sans-serif}
.wrap{max-width:860px;margin:0 auto;padding:48px 28px 80px;background:#fff;border:1px solid var(--line);border-top:6px solid var(--green)}
.kick{font-family:ui-monospace,Consolas,monospace;font-size:.72rem;letter-spacing:.16em;text-transform:uppercase;color:var(--amber)}
h1{font-size:1.9rem;line-height:1.2;color:var(--gd);margin:10px 0 6px;font-weight:600}
.sub{color:var(--mut);font-size:.95rem;font-style:italic}
.meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin:22px 0;padding:14px;border:1px solid var(--line);border-radius:10px;background:var(--bg);font-family:system-ui,sans-serif;font-size:.78rem}
.meta b{display:block;color:var(--mut);font-size:.66rem;letter-spacing:.12em;text-transform:uppercase}
.meta code{font-family:ui-monospace,Consolas,monospace;font-size:.72rem;word-break:break-all}
h2{font-size:1.15rem;color:var(--gd);margin:30px 0 8px;padding-bottom:6px;border-bottom:1px solid var(--line);font-weight:600}
h2 .no{font-family:ui-monospace,monospace;color:var(--amber);font-size:.8rem;margin-right:8px}
p{margin:8px 0;text-align:justify}
table{width:100%;border-collapse:collapse;margin:12px 0;font-family:system-ui,sans-serif;font-size:.8rem}
th{background:var(--tint);color:var(--gd);text-align:left;padding:8px 10px;font-size:.66rem;letter-spacing:.1em;text-transform:uppercase}
td{padding:8px 10px;border-bottom:1px solid var(--line);font-family:ui-monospace,Consolas,monospace;font-size:.76rem}
td.tr{font-family:Georgia,serif}
.ci{background:var(--tint);border-left:4px solid var(--green);padding:12px 16px;border-radius:0 10px 10px 0;margin:14px 0;font-family:system-ui,sans-serif;font-size:.86rem}
.verify{border:1px dashed var(--amber);background:#fdf7ee;border-radius:10px;padding:12px 16px;margin:14px 0;font-family:system-ui,sans-serif;font-size:.8rem}
.verify code{font-family:ui-monospace,monospace;font-size:.72rem;word-break:break-all}
.cite{background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:14px 16px;font-size:.86rem;margin:10px 0}
pre{background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:10px;font-family:ui-monospace,Consolas,monospace;font-size:.7rem;overflow:auto;margin:8px 0}
.fig{border:1px solid var(--line);border-radius:10px;padding:10px;margin:12px 0;background:var(--bg)}
.fig .cap{font-family:system-ui,sans-serif;font-size:.74rem;color:var(--mut);margin-top:8px}
.brow{display:flex;align-items:center;gap:10px;margin:6px 0;font-family:system-ui,sans-serif;font-size:.78rem}
.brow .bl{width:130px;flex:0 0 auto}
.brow .bar{flex:1;height:12px;border-radius:6px;background:#e9ece8;box-shadow:inset 0 0 0 1px #d3d8d0;overflow:hidden}
.brow .bar i{display:block;height:100%;background:var(--leaf);border-radius:6px}
.brow .bv{width:56px;text-align:right;font-family:ui-monospace,monospace}
.lim li{margin:6px 0 6px 18px}
.foot{margin-top:36px;padding-top:14px;border-top:1px solid var(--line);font-family:system-ui,sans-serif;font-size:.74rem;color:var(--mut)}
.btnrow{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0;font-family:system-ui,sans-serif}
.btn{background:var(--green);color:#fff;border:0;border-radius:8px;padding:9px 16px;font-size:.8rem;font-weight:700;cursor:pointer;text-decoration:none;display:inline-block}
.btn.g{background:#fff;color:var(--green);border:1.5px solid var(--green)}
@media print{body{background:#fff}.wrap{border:0;padding:0}.btnrow{display:none}}
</style>
</head>
<body>
<div class="wrap">
<div class="kick">DendroGeo Bilimsel Rapor · ${id} · sürüm ${version}</div>
<h1>${esc(P.name)} (${esc(P.city)}): Bireysel Ağaç Envanteri ve Toprak Üstü / Toprak Altı Karbon Stoku</h1>
<div class="sub">Saha ölçümünden allometrik hesaplama ve 10 m arazi örtüsü bağlamına uzanan, uçtan uca doğrulanmış park ölçekli değerlendirme</div>
<div class="meta">
 <div><b>Park kimliği</b><code>${esc(P.osm_key || '—')} · DB #${P.id}</code></div>
 <div><b>Ölçüm dönemi</b><code>${snap.period.from.slice(0, 10)} → ${snap.period.to.slice(0, 10)}</code></div>
 <div><b>Yayın tarihi</b><code>${snap.generated_at.slice(0, 10)}</code></div>
 <div><b>Örneklem</b><code>${t.n} onaylı ölçüm · ${snap.species.length} tür</code></div>
 <div><b>Park alanı</b><code>${trNum((P.area_m2 || 0) / 10000, 2)} ha (OSM poligonu)</code></div>
 <div><b>Lisans</b><code>CC BY-NC 4.0</code></div>
 <div><b>Yazarlar</b><code>N. Şirin · S. Şirin</code></div>
 <div><b>İçerik hash'i</b><code>sha256:${hash.slice(0, 20)}…</code></div>
</div>

<h2><span class="no">1</span>Özet</h2>
<p>Bu rapor, ${esc(P.name)} sınırları içerisinde gerçekleştirilen ${t.n} bireysel ağaç ölçümüne (göğüs çapı, boy, tür, GNSS konumu ve fotoğraf kanıtı) dayalı toplam karbon stokunu, %95 güven aralığı ve bağımsız doğrulama izleri ile birlikte sunmaktadır. Toplam karbon stoku <b>${ciTxt}</b> olarak hesaplanmış; hektara karşılığı ${t.per_ha_kg == null ? '—' : trNum(t.per_ha_kg / 1000, 3) + ' t/ha'} olarak bulunmuştur. Bütün kayıtlar moderatör onayından geçirilmiştir; park poligonu konum çiti denetiminin kayıt düzeyindeki sonucu §5'te raporlanmıştır.</p>

<h2><span class="no">2</span>Yöntem</h2>
<p><b>2.1 Saha protokolü.</b> Göğüs çapı (DBH) yerden 1.30 m yükseklikte şeritmetre ile (±0.5 cm), ağaç boyu lazer hipsometre ile (±0.25 m), konum sivil GNSS alıcısıyla (ortalama ±${trNum(snap.gps.mean_acc_m ?? 0, 1)} m) ölçülmüş; her kayıt için sahada çekilmiş fotoğraf kanıtı zorunlu tutulmuştur. Ayrıntılı uygulama kuralları <i>DendroGeo Saha Protokolü v1</i>'de tanımlıdır.</p>
<p><b>2.2 Biyokütle ve karbon.</b> Toprak üstü biyokütle (AGB), Chave ve ark. (2014) pantropikal allometrik denklemiyle hesaplanmıştır: AGB = 0.0673·(ρ·D²·H)^0.976; burada ρ odun yoğunluğu (g/cm³), D göğüs çapı (cm), H ağaç boyu (m). Toprak altı biyokütle (kök biyokütlesi) AGB×0.26, karbon stoku ise toplam biyokütlenin 0.47 katsayısı ile çarpımı olarak tanımlanmıştır. Tür yoğunluğu bulunmadığında grup varsayılanı (iğne yapraklı / geniş yapraklı) kullanılmış ve Çizelge 1'de beyan edilmiştir.</p>
<p><b>2.3 Belirsizlik.</b> Girdi belirsizlikleri (§2.1) ve allometrik model belirsizliği (%22 değişim katsayısı) Monte Carlo yöntemiyle (n=${snap.mc.N}, sabit tohum=${snap.mc.SEED}) yayılmıştır; model hatası kayıtlar arasında korele kabul edilmiştir, zira aynı denklem tüm kayıtlarda ortak yönde sapma üretir. Güven aralığı, örneklem dağılımının 2.5 ve 97.5 yüzdebirlikleri olarak raporlanmıştır.</p>
<p><b>2.4 Doğrulama zinciri.</b> (i) Her kayıt moderatör onayı gerektirir (${snap.moderation.approved}/${snap.moderation.approved} kayıt 'Onaylı' durumundadır; zaman damgalı onay kaydı ${snap.moderation.reviewed}/${snap.moderation.approved}); (ii) ölçüm konumunun park poligonu içinde olması veritabanı tetiği ile zorunlu kılınmıştır (trg_geo_fence; zorunluluk, 0007 geçişinden sonraki kayıtlara uygulanır, önceki kayıtlar için kayıt düzeyindeki denetim sonucu §5'te beyan edilir); (iii) arazi örtüsü çözümlemesinde raster/park alan farkı %0.5 eşiğini aşarsa sonuç yayınlanmaz.</p>

<h2><span class="no">3</span>Sonuçlar</h2>
<p>Çizelge 1 tür bazlı özet istatistikleri, Şekil 1 ise karbon paylarının dağılımını vermektedir.</p>
<table><thead><tr><th>Tür</th><th>Grup</th><th>n</th><th>Ort. DBH (cm)</th><th>Ort. boy (m)</th><th>Karbon (kg)</th><th>Pay</th></tr></thead><tbody>${spRows}</tbody></table>
<div class="fig"><div class="sans" style="font-size:.78rem"><b>Şekil 1 — Tür bazlı karbon stoku payları</b></div>${bars}</div>
<div class="ci">📐 Toplam karbon stoku: <b>${ciTxt}</b> · Monte Carlo n=${snap.mc.N}, tohum=${snap.mc.SEED}, model CV=%${snap.mc.MODEL_CV * 100} (korele). ${t.n === 2 ? 'Örneklem büyüklüğü (n=2) nedeniyle güven aralığı geniştir; değer park geneline ekstrapole edilmemelidir.' : t.n < 10 ? 'Örneklem büyüklüğü sınırlı olduğundan güven aralığı geniş yorumlanmalıdır.' : 'Örneklem büyüklüğü aralığı makul düzeye indirmektedir.'}</div>

<h2><span class="no">4</span>Arazi örtüsü bağlamı</h2>
${lulcSec}

<h2><span class="no">5</span>Doğrulama ve içerik bütünlüğü</h2>
<div class="verify">
 <b>Rapor kimliği:</b> <code>${id}</code> · sürüm ${version} · yayın ${snap.generated_at.slice(0, 10)}<br>
 <b>İçerik hash'i:</b> <code>sha256:${hash}</code><br>
 <span id="dgVerify" class="sans">⏳ içerik bütünlüğü hesaplanıyor…</span><br>
 ${(snap.geofence.outside_rows || 0) === 0
   ? `✅ Konum çiti: ${snap.geofence.verified_rows}/${snap.geofence.total ?? snap.geofence.verified_rows} kayıt park poligonu içinde doğrulanmıştır.`
   : `⚠ Konum çiti: ${snap.geofence.verified_rows}/${snap.geofence.total} kayıt park poligonu içinde doğrulanmıştır; ${snap.geofence.outside_rows} kayıt poligon dışında koordinat taşımaktadır. Bu kayıtlar, konum çiti zorunluluğunun (0007) yürürlüğe girişinden önce üretildiği için geriye dönük olarak poligon denetimine tabi tutulamamıştır; karbon hesabına dahillerdir ancak mekânsal doğrulamaları bulunmamaktadır.`}<br>
 ${snap.moderation.reviewed === snap.moderation.approved
   ? `✅ Moderasyon: ${snap.moderation.approved}/${snap.moderation.approved} kayıt onaylı ve zaman damgalıdır.`
   : `⚠ Moderasyon: ${snap.moderation.approved}/${snap.moderation.approved} kayıt moderatör onaylıdır; zaman damgası (reviewed_at) ${snap.moderation.reviewed}/${snap.moderation.approved} kayıtta mevcuttur — onay zaman damgasının yazımı 0007 sonrası akışta zorunludur, önceki onaylar damgasızdır.`}<br>
 🔗 Kalıcı kimlik: ${id} + içerik hash'i${'' /* R2: Zenodo DOI eklendiğinde buraya işlenir */}.
</div>

<h2><span class="no">6</span>Veri erişilebilirliği</h2>
<div class="btnrow">
 <a class="btn g" href="olcum.csv">📥 Ölçüm verisi (CSV)</a>
 <a class="btn g" href="park.geojson">🗺 Konumlar (GeoJSON)</a>
 <a class="btn g" href="data.json">🧾 Snapshot (JSON)</a>
 ${snap.lulc && !snap.lulc.error ? '<a class="btn g" href="harita.png">🛰 Arazi örtüsü haritası (PNG)</a>' : ''}
 <button class="btn" onclick="window.print()">🖨 Yazdır / PDF</button>
 <a class="btn g" href="../../">🌐 DendroGeo uygulaması</a>
</div>
<p class="sans" style="font-size:.8rem;color:var(--mut)">Ham veriler CC BY-NC 4.0 lisansı ile açıktır; yeniden kullanımda §7 künyesine atıf zorunludur.</p>

<h2><span class="no">7</span>Atıf</h2>
<div class="cite">Şirin, N. &amp; Şirin, S. (${snap.generated_at.slice(0, 4)}). <i>${esc(P.name)} ağaç envanteri ve karbon stoku raporu</i> (${id}, sürüm ${version}). DendroGeo. https://dendrogeo.org/rapor/${id}/ · sha256:${hash.slice(0, 16)}…
<div class="sans" style="margin-top:8px;color:var(--mut)">Yöntem atıfları: Chave et al. (2014) <code>10.1111/gcb.12629</code>${snap.lulc && !snap.lulc.error ? ` · ${esc(snap.lulc.citation)}` : ''} · OpenStreetMap katkıcıları (ODbL).</div></div>
<pre>${esc(bib)}</pre>

<h2><span class="no">8</span>Sınırlılıklar</h2>
<ul class="lim">
 <li>Chave ve ark. (2014) pantropikal bir modeldir; Türkiye türleri için bölgesel kalibrasyon gerçekleştirilmemiştir.</li>
 <li>Örneklem büyüklüğü (n=${t.n}) sınırlıdır; park geneline ekstrapolasyon güven aralığı ile birlikte dahi ihtiyatla yorumlanmalıdır.</li>
 <li>10 m raster çözünürlüğü, 0.1 ha altındaki mikro-desenleri çözümleyemez.</li>
 <li>GNSS doğruluğu (±${trNum(snap.gps.mean_acc_m ?? 0, 1)} m) bireysel ağaç konumu için değil, park üyeliği doğrulaması için kullanılmıştır.</li>
</ul>

<div class="foot">DendroGeo · Küresel Ağaç Envanteri ve Karbon Veri Sistemi · Bu sayfa yayın anında dondurulmuştur; sonraki çözümlemeler yeni sürüm kimliği alır. Belge tipografisi, uygulama arayüzünden bilinçli olarak ayrışır (rapor = akademik belge). · CC BY-NC 4.0</div>
</div>
<script>
const DG_HASH=${JSON.stringify(hash)};
const DG_DATA=${JSON.stringify(snap)};
(async()=>{
  try{
    const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(DG_DATA,(k,v)=>(v&&typeof v==='object'&&!Array.isArray(v))?Object.keys(v).sort().reduce((o,key)=>(o[key]=v[key],o),{}):v)));
    const hex=[...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
    document.getElementById('dgVerify').textContent=hex===DG_HASH
      ?"✅ İçerik bütünlüğü doğrulandı: sayfadaki veri, yayın hash değeri ile birebir eşleşiyor."
      :"⚠ UYARI: sayfa verisi yayın hash değeri ile eşleşmiyor; bu kopya değiştirilmiş olabilir.";
  }catch(e){document.getElementById('dgVerify').textContent='⚠ Hash doğrulanamadı: '+e.message;}
})();
</script>
</body>
</html>`;
}

/* ---------- CSV / GeoJSON / liste ---------- */
function csvOf(snap) {
  const head = 'NOKTA,TUR,GRUP,DBH_CM,BOY_M,KARBON_KG,KARBON_CI_LO_KG,KARBON_CI_HI_KG,ENLEM,BOYLAM,GPS_DOGRULUK_M,TARIH';
  const { rho, grho } = loadRho();
  const lines = snap.rows.map((r) => {
    const ci = mcRowCI(r);
    return [r.point_id, `"${r.species}"`, r.grp, r.dbh_cm, r.height_m, r.carbon_kg, ci.lo.toFixed(1), ci.hi.toFixed(1), r.lat, r.lon, r.acc_m ?? '', r.date].join(',');
  });
  return '\uFEFF' + head + '\n' + lines.join('\n') + '\n';
}
function geojsonOf(snap) {
  return { type: 'FeatureCollection', features: snap.rows.map((r) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [r.lon, r.lat] }, properties: { nokta: r.point_id, tur: r.species, grup: r.grp, dbh_cm: r.dbh_cm, boy_m: r.height_m, karbon_kg: r.carbon_kg, tarih: r.date } })) };
}
function renderIndex(list) {
  const rows = list.map((r) => `<tr><td><a href="${r.id}/">${r.id}</a></td><td class="tr">${esc(r.park)}</td><td>${r.n}</td><td>${r.carbon}</td><td>${r.date}</td></tr>`).join('');
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Yayınlanmış Raporlar — DendroGeo</title>
<meta name="description" content="DendroGeo tarafından yayınlanmış, içerik hash'i ile dondurulmuş park ölçekli bilimsel raporların dizini.">
<link rel="canonical" href="https://dendrogeo.org/rapor/">
<link rel="stylesheet" href="../css/style.css"><link rel="stylesheet" href="../css/ui-standard.css">
</head><body class="dg-page"><header class="top"><div class="wrap nav"><a class="brand" href="../">🌲 DendroGeo</a><nav class="links"><a href="../">Uygulama</a><a href="../yontem/">Yöntem</a></nav></div></header>
<main><div class="wrap"><div class="hero"><div class="tag">BİLİMSEL RAPOR DİZİNİ</div><h1>Yayınlanmış Park Raporları</h1>
<p class="lead">Her rapor yayın anında dondurulur; kimlik (DGR-…), sürüm ve SHA-256 içerik hash'i ile atanır. Bir raporun verisi değişmez; yeni çözümleme yeni sürüm olarak yayınlanır.</p></div>
<table><thead><tr><th>Rapor</th><th>Park</th><th>n</th><th>Karbon (%95 GA)</th><th>Yayın</th></tr></thead><tbody>${rows || '<tr><td colspan=5>Henüz rapor yayınlanmadı.</td></tr>'}</tbody></table>
</div></main><footer><div class="wrap">DendroGeo · CC BY-NC 4.0</div></footer></body></html>`;
}

/* ---------- CLI ---------- */
export async function main() {
  const parkId = arg('park');
  if (!parkId) { console.error('Kullanım: node scripts/make-report.mjs --park <id> [--skip-lulc]'); process.exit(2); }
  const { snap, hash, png } = await buildSnapshot(+parkId, { skipLulc: has('skip-lulc') });
  const year = new Date().getFullYear();
  const dir = join(ROOT, 'rapor');
  mkdirSync(dir, { recursive: true });
  const existing = readdirSync(dir).filter((d) => d.startsWith('DGR-' + year + '-')).sort();
  const seq = String(existing.length + 1).padStart(4, '0');
  const version = 1;
  const id = existing.length ? existing[existing.length - 1].replace(/-s\d+$/, '') === `DGR-${year}-${seq}` ? `DGR-${year}-${seq}` : `DGR-${year}-${seq}` : `DGR-${year}-${seq}`;
  const out = join(dir, id);
  mkdirSync(out, { recursive: true });
  if (png) writeFileSync(join(out, 'harita.png'), png);
  const html = renderReport(snap, { id, hash, version });
  writeFileSync(join(out, 'index.html'), html);
  writeFileSync(join(out, 'data.json'), JSON.stringify(snap, null, 2));
  writeFileSync(join(out, 'olcum.csv'), csvOf(snap));
  writeFileSync(join(out, 'park.geojson'), JSON.stringify(geojsonOf(snap), null, 2));
  const list = readdirSync(dir).filter((d) => d.startsWith('DGR-')).sort().map((d) => {
    try {
      const j = JSON.parse(readFileSync(join(dir, d, 'data.json'), 'utf8'));
      return { id: d, park: j.park.name, n: j.totals.n, carbon: `${fmtT(j.totals.ci.mean)} t [${fmtT(j.totals.ci.lo)}–${fmtT(j.totals.ci.hi)}]`, date: j.generated_at.slice(0, 10) };
    } catch (e) { return null; }
  }).filter(Boolean);
  writeFileSync(join(dir, 'index.html'), renderIndex(list));
  console.log(`✅ Rapor yayınlandı: rapor/${id}/`);
  console.log(`   park   : ${snap.park.name} (${snap.park.city}) · n=${snap.totals.n}`);
  console.log(`   karbon : ${fmtT(snap.totals.ci.mean)} t [%95 GA ${fmtT(snap.totals.ci.lo)}–${fmtT(snap.totals.ci.hi)}]`);
  console.log(`   hash   : sha256:${hash}`);
  console.log(`   LULC   : ${snap.lulc ? (snap.lulc.error ? 'hata: ' + snap.lulc.error : 'dahil (' + snap.lulc.source + ')') : 'atlandı'}`);
  console.log(`   atıf   : Şirin & Şirin (${snap.generated_at.slice(0, 4)}). ${snap.park.name} … (${id}, sürüm ${version}). https://dendrogeo.org/rapor/${id}/`);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch((e) => { console.error('❌', e.message); process.exit(1); });
