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
import { execSync } from 'node:child_process';
import { mcTotalCI, mcRowCI, canonicalHash, MC_CFG, fmtT, loadRho, loadSpeciesDict, QA_LIMITS, calcRow as _calcRow, carbonKg } from './lib/mc.mjs';
import { PngCanvas, hex2rgb } from './lib/png.mjs';
import { createRequire } from 'node:module';
const require_ = createRequire(import.meta.url);
/* qrcode (MIT) YALNIZ build bağımlılığıdır. Kurulu değilse (örn. npm install
 * çalıştırılmamış ortam) rapor üretimi ÇÖKMEZ: QR hücresi atlanır, kalıcı
 * adres künyede metin olarak kalır. QR kozmetiktir; kimlik/hash ondan
 * bağımsızdır. */
let QRlib = null;
try { QRlib = require_('qrcode'); } catch (e) { QRlib = null; }

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
/* Yayın kökü: CNAME'den türetilir (elle yazılmış sabit URL sürüklenmesin). */
const SITE_ORIGIN = (() => { try { const c = read('CNAME').trim(); return c ? 'https://' + c : 'https://dendrogeo.org'; } catch (e) { return 'https://dendrogeo.org'; } })();
const arg = (a) => { const i = process.argv.indexOf('--' + a); return i >= 0 ? process.argv[i + 1] : null; };
const has = (a) => process.argv.includes('--' + a);

/* Rapor parmak izi sabitleri (2026-09-28 · kullanıcı standardı): motor sürümü
 * lc-config'den (tek doğruluk kaynağı), uygulama sürümü package.json'dan,
 * git commit üretim anındaki depodan okunur. Değer yoksa null → rapor '—'
 * basar; ASLA uydurulmaz. */
const ENGINE_VERSION = (() => { try { const m = read('src/services/lc-config.js').match(/DG_LC_ENGINE_VERSION\s*=\s*"([^"]+)"/); return m ? m[1] : null; } catch (e) { return null; } })();
const APP_VERSION = (() => { try { return JSON.parse(read('package.json')).version || null; } catch (e) { return null; } })();
const GIT_COMMIT = (() => { try { return execSync('git rev-parse HEAD', { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || null; } catch (e) { return null; } })();
const DATASET_DEFAULT = 'ESA WorldCover 10 m · 2021 (v200)';
const DATASET_ASCII = 'ESA WORLDCOVER 2021 V200';
export const DGR_ID_RE = /^DGR-\d{4}-\d{4}$/;

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
  /* 0011 (2026-09-28 · Göksu bulgusu): geom_json her zaman gerçek sınır
   * DEĞİLDİR — park 25'te 5 noktalı dikdörtgen (bbox) taşıyordu; jeodezik
   * alanı 68,93 ha, künye alanı 50,11 ha. LULC "alan dengesi" QA kapısı bu
   * yüzden %37,6 farkla haklı olarak bloke etti. Bbox tespit edilirse
   * geom_json YOK SAYILIR ve OSM poligonuna düşülür; karar geometry_qa
   * üzerinden §2/§7/§9'da beyan edilir. */
  if (park.geom_json && park.geom_json.outer && !bboxRing(park.geom_json.outer[0]))
    return { outer: park.geom_json.outer[0], holes: (park.geom_json.inner || []) };
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
/* POLİGON KENDİNİ KESME TARAMASI (2026-09-28 · QA yıldızı): elle çizilen
 * park sınırları düğüm (bowtie) içerebilir. Shoelace/jeodezik alan düğüm
 * loplarını ÇIKARIR, raster hücre ayrışımı farklı sayar → LULC QA eşiği
 * (|kapsama−park|/park ≤ %0,5) haklı olarak takılır. Rapor bu takılmanın
 * NEDENİNİ beyan etmek zorundadır: sayı burada hesaplanır, snapshot'a
 * geometry_qa olarak girer (§2, §7, §9). O(n²) — 600 noktadan büyük
 * halkalarda koşulmaz (null = "taranmadı" demek, ASLA "temiz" demek değil). */
export function ringSelfIntersections(ring) {
  const n = (ring || []).length;
  if (n < 4) return 0;
  const cr = (o, p, q) => (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0]);
  const segX = (a, b, c, d) => {
    const d1 = cr(c, d, a), d2 = cr(c, d, b), d3 = cr(a, b, c), d4 = cr(a, b, d);
    return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
  };
  let c = 0;
  for (let i = 0; i < n - 1; i++)
    for (let j = i + 2; j < n - 1; j++) {
      if (i === 0 && j === n - 2) continue;
      if (segX(ring[i], ring[i + 1], ring[j], ring[j + 1])) c++;
    }
  return c;
}
export function geometrySelfIntersections(outer, holes) {
  let total = ringSelfIntersections(outer);
  for (const h of holes || []) total += ringSelfIntersections(h);
  return total;
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
  /* Analiz EPSG'si: harita altbilgisi ve §11 parmak izi için üst veri
   * (koordinat uzayı BÜYÜKLÜKTEN tanınmaya devam eder; bu yalnız kayıt). */
  const epsg = runs.length && Number.isFinite(Number(runs[0].epsg)) ? Number(runs[0].epsg) : null;
  return { report, cells: cells && cells.features ? cells.features : [], wruns, outer, holes, epsg };
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
export function mapCanvas({ outer, holes = [], wruns = [], classes = {}, parkName = '', sub = '', sub2 = '', maskHa = 0, points = [], pointStat = null, meta = null }) {
  const PAD = 26, TOP = 96, MAPH = 540, FOOT = 70;
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
  const H = TOP + MAPH + 16 + legRows.length * 28 + 18 + FOOT;
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
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const a = Math.max(0, Math.ceil(xs[i] ?? 0)), b = Math.min(cv.w - 1, Math.floor(xs[i + 1] ?? cv.w));
      if (x < a) cv.rect(x, y, a - 1, y, MAP_TONES.out);
      x = Math.max(x, b + 1);
    }
    if (x < cv.w) cv.rect(x, y, cv.w - 1, y, MAP_TONES.out);
  }
  /* İNCE ÇERÇEVE (2026-09-28): harita alanı kartografik çerçeve alır; kırpma
   * geçişinden SONRA çizilir (aksi hâlde bağlam dokusu çerçeveyi silerdi). */
  const FR = [206, 210, 206];
  const fx0 = PAD - 12, fy0 = TOP - 12, fx1 = W - PAD + 12, fy1 = TOP + MAPH + 12;
  cv.line(fx0, fy0, fx1, fy0, FR); cv.line(fx0, fy1, fx1, fy1, FR);
  cv.line(fx0, fy0, fx0, fy1, FR); cv.line(fx1, fy0, fx1, fy1, FR);
  strokeRing(cv, ring, MAP_TONES.halo, 2);                    /* halo: sınır her zeminde okunur */
  strokeRing(cv, ring, MAP_TONES.ink, 1);
  /* Envanter noktaları YALNIZ harita çerçevesi içine çizilir: poligondan
   * çok uzak (eski/hatalı GNSS) bir kayıt lejant/altbilgi üzerine binemez. */
  for (const p of points) {
    const pxX = X(p.lon), pxY = Y(p.lat);
    if (pxX < fx0 || pxX > fx1 || pxY < fy0 || pxY > fy1) continue;
    disc(cv, pxX, pxY, 5, MAP_TONES.halo); disc(cv, pxX, pxY, 3, MAP_TONES.ink);
  }
  const T = (x, y, t, c, sc) => cv.text(x, y, t, c, sc);
  T(PAD, 12, parkName, MAP_TONES.ink, 3);
  T(PAD, 44, sub, MAP_TONES.mut, 2);
  if (sub2) T(PAD, 66, sub2, MAP_TONES.mut, 2);
  /* Belge kimliği sağ üstte: harita tek başına dolaşıma girse bile hangi
   * DGR'ye ait olduğu üzerinde yazılıdır (kullanıcı standardı md. 10). */
  if (meta && meta.id) {
    const tid = String(meta.id);
    T(Math.max(PAD, W - PAD - 12 * tid.length), 12, tid, MAP_TONES.mut, 2);
  }
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
  /* ÖLÇEK ÇUBUĞU: dönüşümlü koyu/açık segmentler (klasik kartografik biçim);
   * kuzey oku aynen kalır. */
  const nice = [10, 20, 50, 100, 200, 500].find((m) => m * k > 90) || 1000;
  const barW = nice * k, segN = 4, sx0 = W - PAD - barW, sy0 = TOP + MAPH - 40, sy1 = TOP + MAPH - 32;
  for (let i = 0; i < segN; i++) {
    const a = sx0 + barW * i / segN, b = sx0 + barW * (i + 1) / segN;
    cv.rect(a, sy0, b - 1, sy1, i % 2 === 0 ? MAP_TONES.ink : [255, 255, 255]);
  }
  cv.line(sx0, sy0, sx0 + barW, sy0, MAP_TONES.ink);
  cv.line(sx0, sy1, sx0 + barW, sy1, MAP_TONES.ink);
  cv.line(sx0, sy0, sx0, sy1, MAP_TONES.ink);
  cv.line(sx0 + barW, sy0, sx0 + barW, sy1, MAP_TONES.ink);
  T(sx0, sy0 - 22, nice + ' m', MAP_TONES.ink, 2);
  cv.line(W - PAD - 14, TOP + 60, W - PAD - 14, TOP + 26, MAP_TONES.ink);
  cv.line(W - PAD - 20, TOP + 36, W - PAD - 14, TOP + 24, MAP_TONES.ink);
  cv.line(W - PAD - 8, TOP + 36, W - PAD - 14, TOP + 24, MAP_TONES.ink);
  T(W - PAD - 24, TOP + 66, 'N', MAP_TONES.ink, 2);
  /* ALT BİLGİ ŞERİDİ (kullanıcı standardı md. 10): belge kimliği, veri
   * kaynağı, çözünürlük, projeksiyon, analiz tarihi, motor sürümü ve telif.
   * Metin ASCII'ye translitere edilir (png.mjs glif kümesi); dar tuvallerde
   * punto otomatik küçülür (Tfit), taşma olmaz. */
  const fy = H - FOOT + 12;
  cv.line(PAD, fy - 8, W - PAD, fy - 8, FR);
  const Tfit = (x, y, txt, c) => T(x, y, txt, c, (12 * txt.length <= W - 2 * PAD) ? 2 : 1);
  const idLine = meta && meta.id ? ('DENDROGEO - ' + meta.id) : 'DENDROGEO - BILIMSEL ANALIZ HARITASI';
  T(PAD, fy, idLine, MAP_TONES.ink, 2);
  const cr = '© DENDROGEO';
  if (W - PAD - 12 * cr.length > PAD + 12 * idLine.length + 8) T(W - PAD - 12 * cr.length, fy, cr, MAP_TONES.mut, 2);
  Tfit(PAD, fy + 20, 'VERI: ' + ((meta && meta.source) || DATASET_ASCII) + ' / COZUNURLUK: 10 M' + (meta && meta.epsg ? ' / PROJEKSIYON: EPSG:' + meta.epsg : ''), MAP_TONES.mut);
  if (meta && (meta.dateStr || meta.engine)) {
    const l3 = (meta.dateStr ? 'ANALIZ TARIHI: ' + meta.dateStr : '') +
      (meta.dateStr && meta.engine ? ' / ' : '') +
      (meta.engine ? 'DENDROGEO LC ENGINE V' + meta.engine : '') + ' / CC BY-NC 4.0';
    Tfit(PAD, fy + 40, l3, MAP_TONES.mut);
  }
  return cv;
}
export function renderMapPNG(opts) { return mapCanvas(opts).encode(); }

/* ---------- envanter QA yardımcıları (0011 · v2.1) ---------- */
/* Halka yalnız 2 benzersiz enlem + 2 benzersiz boylam taşıyorsa dikdörtgen
 * (bbox) demektir: gerçek park sınırı değil, arama kutusudur. */
export function bboxRing(ring) {
  const r = (ring || []).filter((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]));
  if (r.length < 4) return false;
  return new Set(r.map((p) => p[0])).size === 2 && new Set(r.map((p) => p[1])).size === 2;
}
/* Jeodezik alan (m²): yerel enlem ölçekli shoelace; QA beyanları için. */
export function ringGeodesicAreaM2(ring) {
  const r = (ring || []).filter((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]));
  if (r.length < 3) return 0;
  const R = 6371008.8, k = Math.PI / 180;
  const lat0 = r.reduce((a, p) => a + p[0], 0) / r.length, c = Math.cos(lat0 * k);
  const xy = r.map((p) => [p[1] * k * R * c, p[0] * k * R]);
  let s = 0;
  for (let i = 0; i < xy.length - 1; i++) s += xy[i][0] * xy[i + 1][1] - xy[i + 1][0] * xy[i][1];
  return Math.abs(s / 2);
}
/* ENVANTER KALİTE KAPISI (QA v2.1): kayıtları kanonik tür sözlüğü ve panel
 * denklemiyle (mc.calcRow) yeniden hesaplar; birim kayması (çevre→çap,
 * mm→cm), ondalık kayması ve sözlük dışı tür adları SAYIYLA yakalanır.
 * Eşik ihlali raporda beyan edilir; sistemik ihlal (≥ BLOCK_MIN_N kayıt VE
 * > BLOCK_RATIO oran) yayını bloklar. */
export function inventoryQa(rows, dict) {
  const base = loadRho();
  /* ρ önceliği: kanonik ad sözlükte (gizli kayıtlar dahil) ρ taşıyorsa o
   * kullanılır — saklı carbon_kg'yi üreten tabloyla birebir denetim. Panel
   * hesabı (calc) bundan ETKİLENMEZ; bu yalnız QA/yeniden hesap yoludur. */
  const rho = Object.assign({}, base.rho);
  for (const e of Object.values(dict.byName)) if (e.rho) rho[e.tr] = e.rho;
  const grho = base.grho;
  const out = { n: 0, n_rows: 0, unknown: [], n_unknown: 0, hd_fail: [], hd_block: false, dev_fail: [], dev_block: false, rows: [] };
  for (const r of rows || []) {
    out.n++;
    const d = +r.dbh_cm, h = +r.height_m, c = +r.carbon_kg;
    const canon = dict.resolve(r.species);
    if (!canon) out.unknown.push(String(r.species));
    const hd = (d > 0 && h > 0) ? (100 * h) / d : null; /* birimsiz: h(m) / D(m) */
    const hdFail = hd != null && (hd < QA_LIMITS.HD_MIN || hd > QA_LIMITS.HD_MAX);
    if (hdFail) out.hd_fail.push({ point_id: +r.point_id, hd: +hd.toFixed(2) });
    let dev = null, devFail = false, exp = null;
    if (d > 0 && h > 0 && Number.isFinite(c) && c > 0) {
      exp = _calcRow(d, h, canon || r.species, r.grp, { rho, grho }).total_carbon;
      if (exp > 0) {
        dev = +(((c - exp) / exp) * 100).toFixed(1);
        /* küçük kayıtlarda yuvarlama gürültüsü bayraklanmaz (mutlak taban) */
        devFail = Math.abs(dev) > QA_LIMITS.CARBON_DEV_PCT && Math.abs(c - exp) >= (QA_LIMITS.CARBON_DEV_MIN_KG ?? 0);
        if (devFail) out.dev_fail.push({ point_id: +r.point_id, stored: c, expected: +exp.toFixed(1), dev_pct: dev });
      }
    }
    out.rows.push({ id: r.id, point_id: +r.point_id, species: String(r.species ?? ''), canonical: canon, hd: hd == null ? null : +hd.toFixed(2), hd_fail: !!hdFail, stored_carbon_kg: Number.isFinite(c) ? c : null, expected_carbon_kg: exp == null ? null : +exp.toFixed(1), dev_pct: dev, dev_fail: devFail });
    out.n_rows++;
  }
  out.unknown = [...new Set(out.unknown)].sort((a, b) => a.localeCompare(b, 'tr'));
  out.n_unknown = out.unknown.length;
  const N = out.n || 1;
  out.hd_block = out.hd_fail.length >= QA_LIMITS.BLOCK_MIN_N && out.hd_fail.length / N > QA_LIMITS.BLOCK_RATIO;
  out.dev_block = out.dev_fail.length >= QA_LIMITS.BLOCK_MIN_N && out.dev_fail.length / N > QA_LIMITS.BLOCK_RATIO;
  return out;
}

/* ---------- snapshot ---------- */
export async function buildSnapshot(parkId, { skipLulc = false, meta = null } = {}) {
  const genAt = new Date().toISOString();
  const park = (await rest('parks', { id: 'eq.' + parkId, limit: 1 }))[0];
  if (!park) throw new Error('Park bulunamadı: ' + parkId);
  const SEL_V21 = 'id,point_id,measurement_no,species,grp,dbh_cm,girth_cm,height_m,carbon_kg,volume_m3,lat,lon,accuracy_m,created_at,reviewed_at,photo_url,photo_file';
  const SEL_V2 = 'id,point_id,measurement_no,species,grp,dbh_cm,height_m,carbon_kg,lat,lon,accuracy_m,created_at,reviewed_at,photo_url';
  let rows;
  try {
    rows = await rest('measurements', { select: SEL_V21, park_id: 'eq.' + parkId, status: 'eq.Onaylı', order: 'point_id.asc' });
  } catch (e) {
    /* 0011 henüz uygulanmadı → girth_cm/volume_m3 kolonları yok; eski seçime düş */
    rows = await rest('measurements', { select: SEL_V2, park_id: 'eq.' + parkId, status: 'eq.Onaylı', order: 'point_id.asc' });
  }
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
  const ringPts = OG ? (OG.outer.length + (OG.holes || []).reduce((a, h) => a + h.length, 0)) : 0;
  const gjRing = (park.geom_json && Array.isArray(park.geom_json.outer) && park.geom_json.outer[0]) || null;
  const gjBbox = gjRing ? bboxRing(gjRing) : false;
  const geometryQA = OG ? {
    source: (gjRing && !gjBbox) ? 'parks.geom_json (uygulamada çizilen sınır)' : ('OSM ' + (park.osm_key || '—')),
    ring_points: ringPts,
    ring_area_m2: OG ? Math.round(ringGeodesicAreaM2(OG.outer)) : null,
    self_intersections: ringPts <= 600 ? geometrySelfIntersections(OG.outer, OG.holes) : null,
    /* geom_json bbox ise analiz OSM poligonundan yürür; rapor bunu beyan eder */
    geom_json_bbox_ignored: gjBbox ? { ring_points: gjRing.length, ring_area_m2: Math.round(ringGeodesicAreaM2(gjRing)) } : null,
  } : null;
  /* Envanter kalite kapısı: kanonik sözlük + panel denklemiyle yeniden hesap */
  const qaSpecies = inventoryQa(rows, loadSpeciesDict());
  /* YAZAR (0012+0015 · kullanıcı standardı): rapor, PARKIN VERİSİNİ ÖLÇEN
   * kullanıcının adıyla yayımlanır. Öncelik zinciri:
   *   1) dg_park_author(park)  — en çok onaylı katkısı olan kayıt sahibi (0015)
   *   2) v_report_authors      — son yayın isteğini açan kullanıcı (0012)
   *   3) kurumsal "DendroGeo"  — İSİM UYDURULMAZ
   * (DGR-2026-0004 dersi: istek Sinan'dan gelince künyede Sinan yazdı; oysa
   * 34 kaydın sahibi Nagihan. Ölçen kişi istek açandan önceliklidir.) */
  let author = { name: null, full_name: null, source: 'unresolved' };
  const setName = (nm, src) => { author = { name: nm, full_name: nm, source: src }; };
  try {
    const pa = await rest('rpc/dg_park_author', { park: parkId });
    if (pa && pa[0] && String(pa[0].full_name || '').trim()) setName(String(pa[0].full_name).trim(), 'data_owner');
  } catch (e) { /* 0015 henüz uygulanmadı → sıradaki kaynak */ }
  if (!author.name) {
    try {
      const ra = await rest('v_report_authors', { park_id: 'eq.' + parkId, order: 'created_at.desc', limit: '1' });
      if (ra && ra[0] && String(ra[0].full_name || '').trim()) setName(String(ra[0].full_name).trim(), 'report_request');
    } catch (e) { author = { name: null, full_name: null, source: 'unavailable', note: String((e && e.message) || e).slice(0, 120) }; }
  }
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
          coverage_m2: Math.round(L.report.rasterCoverageAreaM2 || 0),
          classified_m2: Math.round(L.report.classifiedAreaM2 || 0),
          epsg: L.epsg || null,
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
            meta: {
              id: (meta && meta.id) || null,
              epsg: L.epsg || null,
              dateStr: fmtDateDot(genAt),
              source: DATASET_ASCII,
              engine: ENGINE_VERSION,
            },
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
    generated_at: genAt,
    /* Üretim izi (2026-09-28): §11 Analiz Parmak İzi ve metadata.json buradan
     * okur. Hash bu alanları da kapsar → parmak izi sonradan değiştirilemez. */
    provenance: {
      engine: 'DendroGeo LC Engine',
      engine_version: ENGINE_VERSION,
      app_version: APP_VERSION,
      git_commit: (meta && meta.git_commit) || GIT_COMMIT || null,
      report_id: (meta && meta.id) || null,
      epsg: (lulc && lulc.epsg) || null,
      resolution_m: 10,
      dataset: (lulc && lulc.source) || DATASET_DEFAULT,
    },
    mc: { ...MC_CFG },
    totals: { n: rows.length, carbon_kg: +rows.reduce((a, r) => a + +r.carbon_kg, 0).toFixed(2), ci: { mean: +ci.mean.toFixed(2), lo: +ci.lo.toFixed(2), hi: +ci.hi.toFixed(2) }, per_ha_kg: park.area_m2 > 0 ? +(rows.reduce((a, r) => a + +r.carbon_kg, 0) / (park.area_m2 / 10000)).toFixed(2) : null },
    species: Object.entries(bySp).map(([sp, b]) => ({ species: sp, grp: b.grp, n: b.n, mean_dbh: +(b.dbh / b.n).toFixed(1), mean_h: +(b.h / b.n).toFixed(1), carbon_kg: +b.c.toFixed(2), share_pct: +(100 * b.c / rows.reduce((a, r) => a + +r.carbon_kg, 0)).toFixed(1) })),
    gps: { n: rows.length, n_with_acc: acc.length, n_null_acc: rows.length - acc.length, mean_acc_m: acc.length ? +((acc.reduce((a, b) => a + b, 0) / acc.length)).toFixed(1) : null },
    period: { from: dates[0], to: dates[dates.length - 1] },
    moderation: { approved: rows.length, reviewed },
    geofence: {
      policy: 'park poligonu içinde ölçüm zorunlu (trg_geo_fence, 0007)',
      total: rows.length,
      verified_rows: gfInside == null ? rows.length : gfInside,
      outside_rows: gfInside == null ? 0 : rows.length - gfInside,
      polygon_source: OG ? (park.geom_json && park.geom_json.outer ? 'parks.geom_json' : 'OSM') : 'yok',
    },
    author,
    geometry_qa: geometryQA,
    qa: { species: qaSpecies, photos: { n_with: rows.filter((r) => r.photo_url).length, n: rows.length } },
    lulc,
    rows: rows.map((r) => ({ id: r.id, point_id: r.point_id, species: r.species, grp: r.grp, dbh_cm: +r.dbh_cm, girth_cm: r.girth_cm == null ? null : +r.girth_cm, height_m: +r.height_m, carbon_kg: +r.carbon_kg, volume_m3: r.volume_m3 == null ? null : +r.volume_m3, lat: +(+r.lat).toFixed(6), lon: +(+r.lon).toFixed(6), acc_m: r.accuracy_m, photo: !!r.photo_url, photo_file: r.photo_file || null, date: r.created_at.slice(0, 10) })),
  };
  return { snap, hash: canonicalHash(snap), png, outerL };
}

/* ---------- render: akademik belge (v2 · 2026-09-28) ----------
 * Kullanıcı standardı (2026-09-28): DGR kimliğinin resmi tanımı, belge
 * künyesi, büyütülmüş yöntem, QA/QC + alan dengesi, sonuç/yorum ayrımı,
 * sınırlılıklar, analiz parmak izi, tekrar üretilebilirlik, rapor geçmişi,
 * atıf (DOI'ye bağlanabilir) ve kaynakça. Sertifika dili YOK: "onaylı",
 * "kesin sonuç", "%100 doğruluk", "resmî belge", "sertifikalı" iddiaları
 * bu belgede kullanılamaz.
 * DGR — DendroGeo Bilimsel Analiz Raporu (iç/alan kimliği); DOI atanırsa
 * harici kalıcı kimlik olarak §11'e ve metadata.json'a işlenir. */
const DGR_TITLE_DEF = 'DGR — DendroGeo Bilimsel Analiz Raporu';
/* Yazar/ad biçimleme (0012): "Ad Soyad" → "Soyad, A." (atıf düzeni).
 * Tek kelimeli adlar olduğu gibi kalır; virgüllü adlar zaten atıf biçimindedir. */
export function citeName(full) {
  const t = String(full || '').trim().replace(/\s+/g, ' ');
  if (!t) return null;
  if (t.includes(',')) return t;
  const ps = t.split(' ');
  if (ps.length < 2) return t;
  const soy = ps[ps.length - 1];
  const ad = ps.slice(0, -1).join(' ');
  return soy + ', ' + ad.charAt(0) + '.';
}
/* Site kurucuları her raporda beyan edilir (kullanıcı standardı 2026-09-28);
 * yazar DEĞİLDİR — yazar, yayını isteyen kullanıcının kendisidir. */
export const FOUNDERS_LINE = 'Site kurucuları: Nagihan Şirin, Sinan Şirin';
const GROUP_TR = { 'İBRELİ': 'ibreli', 'IBRELI': 'ibreli', 'YAPRAKLI': 'yapraklı', 'DİĞER': 'diğer', 'DIGER': 'diğer' };
/* Şekil 1 bar renkleri (kullanıcı isteği 2026-09-28): ibreli = yeşil,
 * yapraklı = turuncu, diğer = gri. CSS varsayılanı yaprak yeşili kalır. */
const GRP_COLORS = { 'İBRELİ': '#2f9e44', 'IBRELI': '#2f9e44', 'YAPRAKLI': '#e8590c', 'DİĞER': '#8a928c', 'DIGER': '#8a928c' };
const grpColor = (g) => GRP_COLORS[String(g || '')] || '#8a928c';
const grpTr = (g) => GROUP_TR[String(g || '')] || String(g || '').toLowerCase();
export function fmtDateTr(iso, tz = 'UTC') {
  try { return new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: tz }); }
  catch (e) { return String(iso || '').slice(0, 10); }
}
export function fmtDateDot(iso) {
  try {
    const d = new Date(iso);
    return String(d.getUTCDate()).padStart(2, '0') + '.' + String(d.getUTCMonth() + 1).padStart(2, '0') + '.' + d.getUTCFullYear();
  } catch (e) { return '—'; }
}
export function epsgLabel(epsg) {
  const n = Number(epsg);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n === 4326) return 'EPSG:4326 (WGS 84 coğrafi)';
  if (n >= 32601 && n <= 32660) return `EPSG:${n} (UTM ${n - 32600}N)`;
  return 'EPSG:' + n;
}

export function renderReport(snap, { id, hash, version = 1, meta = null }) {
  const t = snap.totals, P = snap.park;
  const M = Object.assign({}, snap.provenance || {}, meta || {});
  const verTxt = String(version).includes('.') ? String(version) : version + '.0';
  const L = (snap.lulc && !snap.lulc.error) ? snap.lulc : null;
  const GQ = snap.geometry_qa || null;
  const GJ = (GQ && GQ.geom_json_bbox_ignored) || null;
  /* §2 saha sınırı kaynağı: GQ.source'a esc() tümüyle uygulanıyordu → <code>
   * etiketi de kaçıyordu (v2'den beri sessiz kozmetik hata; ekranda
   * "&lt;code&gt;way/…&lt;/code&gt;" görünüyordu). Etiket dışarıda kurulur,
   * yalnız DEĞERLER kaçırılır. */
  const srcTxt = GQ
    ? (GQ.source.includes('geom_json')
      ? 'uygulamada çizilen park poligonundan (parks.geom_json)'
      : 'OpenStreetMap <code>' + esc(P.osm_key || '—') + '</code> geometrisinden')
    : 'OpenStreetMap <code>' + esc(P.osm_key || '—') + '</code> geometrisinden';
  const INV = snap.qa && snap.qa.species ? snap.qa.species : null;
  const G = snap.gps || {};
  const knotN = (GQ && GQ.self_intersections != null) ? GQ.self_intersections : null;
  const knotted = knotN != null && knotN > 0;
  const ciTxt = `${fmtT(t.ci.mean)} t [%95 GA: ${fmtT(t.ci.lo)}–${fmtT(t.ci.hi)}]`;
  const engine = M.engine || 'DendroGeo LC Engine';
  const engineVer = M.engine_version || null;
  const appVer = M.app_version || null;
  const git = M.git_commit || null;
  const dataset = (L && L.source) || 'ESA WorldCover 10 m · 2021 (v200)';
  const dataYear = (L && L.year) || 2021;
  const epsg = epsgLabel((L && L.epsg) || M.epsg || null);
  const genTr = fmtDateTr(snap.generated_at);
  /* QR (kullanıcı standardı md. 15): basılı PDF bile dijital kayda bağlansın
   * diye kalıcı rapor adresinin QR'ı künyede taşınır. SVG, publishPark
   * tarafından ÜRETİM ANINDA (async) hazırlanıp meta.qr_uri ile iner →
   * sayfada dış istek YOK, çevrimdışı/PDF'te çalışır. Üretim başarısızsa
   * hücre hiç basılmaz (rapor QR'sız da geçerlidir; adres metni kalır). */
  const REPORT_URL = SITE_ORIGIN + '/rapor/' + id + '/';
  const qrUri = (M && M.qr_uri) || null;
  const subject = `${P.name} Ağaç Envanteri, Karbon Stoku ve Arazi Örtüsü Analizi`;
  const titleMain = `${esc(P.name)} (${esc(P.city)}): Bireysel Ağaç Envanteri ve Toprak Üstü / Toprak Altı Karbon Stoku`;

  /* ---- Şekil 1: grup renkli barlar ---- */
  const maxShare = Math.max(...snap.species.map((s) => s.share_pct), 1);
  const sw = (c) => `<span class="sw" style="background:${c}"></span>`;
  const bars = snap.species.map((s) => `<div class="brow"><span class="bl">${esc(s.species)}</span><div class="bar"><i style="width:${(s.share_pct / maxShare * 100).toFixed(1)}%;background:${grpColor(s.grp)}"></i></div><span class="bv">%${trNum(s.share_pct, 1)}</span></div>`).join('');

  /* ---- tür tablosu ---- */
  const spRows = snap.species.map((s) => `<tr><td class="tr">${esc(s.species)}</td><td><span class="grp">${sw(grpColor(s.grp))}${esc(s.grp)}</span></td><td>${s.n}</td><td>${trNum(s.mean_dbh, 1)}</td><td>${trNum(s.mean_h, 1)}</td><td>${trNum(s.carbon_kg, 1)}</td><td>%${trNum(s.share_pct, 1)}</td></tr>`).join('');

  /* ---- QA/QC sayıları (gerçek değerler; uydurma yok) ---- */
  const NR = (snap.rows && snap.rows.length) || t.n; /* kayıt düzeyi QA tabanı */
  const nPhoto = (snap.qa && snap.qa.photos) ? snap.qa.photos.n_with : (snap.rows || []).filter((r) => r.photo !== false && r.photo != null ? r.photo : true).length;
  const parkHa = (P.area_m2 || 0) / 10000;
  const covHa = (L && L.coverage_m2) ? L.coverage_m2 / 10000 : null;
  const clsHa = (L && L.classified_m2) ? L.classified_m2 / 10000 : null;
  const diffHa = (covHa != null) ? covHa - parkHa : null;
  const deltaPct = (L && L.areaDeltaPct != null) ? L.areaDeltaPct : null;
  const qaRow = (k, ok, det) => `<tr><td class="tr">${k}</td><td class="${ok === true ? 'qok' : (ok === false || String(ok).startsWith('⚠')) ? 'qwarn' : ''}">${ok === true ? '✓ Geçerli' : ok === false ? '⚠ Kontrol edilemedi' : ok}</td><td>${det}</td></tr>`;
  const qaRows = [
    qaRow('Park geometrisi', knotted ? '⚠ Düğümlü sınır' : (P.osm_key || P.area_m2 > 0 ? true : false),
      `${GQ ? esc(GQ.source) : 'OSM poligonu <code>' + esc(P.osm_key || '—') + '</code>'} · ${trNum(parkHa, 2)} ha` +
      (knotted ? ` · <b>${knotN} kendini kesen segment çifti</b> (düğüm)${L ? '' : ' — arazi örtüsü çözümlemesi bu nedenle QA eşiğine takıldı'}` : knotN === 0 ? ' · kendini kesme yok (tarandı)' : GQ && GQ.self_intersections == null ? ' · düğüm taraması koşulmadı (halka > 600 nokta)' : '')),
    L ? qaRow('Raster kapsama', (L.cells || 0) > 0 && covHa > 0, `${L.cells || 0} kaynak hücre · kapsama ${covHa != null ? trNum(covHa, 2) + ' ha' : '—'}`) : null,
    L ? qaRow('Alan dengesi', deltaPct != null && deltaPct <= 0.5, deltaPct != null ? `raster/park alan farkı %${trNum(deltaPct, 3)} (eşik %0,500)` : '—') : null,
    L ? qaRow('Hücre–kesit hesabı', true, 'tam poligon–hücre kesişimi; sınır hücrelerinde alan ağırlıklı hesap') : null,
    L ? qaRow('Veri kaynağı', !!L.source, `${esc(dataset)} · yıl ${dataYear} · 10 m`) : null,
    L ? qaRow('Sınıflandırma', (L.classes || []).length > 0, `${(L.classes || []).length} sınıf${L.masked_ha > 0 ? ` · maskeli ${trNum(L.masked_ha, 2)} ha (bulut/gölge)` : ' · maskeli alan yok'}`) : null,
    L && L.agreement ? qaRow('Çapraz doğrulama', true, `${esc(L.cross || 'bağımsız kaynak')} uzlaşması: ${Object.entries(L.agreement).map(([k, v]) => `${esc(k)} %${trNum(v.agreementPct, 0)}`).join(', ')}`) : null,
    INV ? qaRow('Tür sözlüğü eşleşmesi', INV.n_unknown === 0 ? true : `⚠ ${INV.n_unknown} tür dışarıda`, `${INV.n_rows - INV.n_unknown}/${INV.n_rows} kayıt kanonik tür sözlüğüyle eşleşti${INV.unknown.length ? ' · sözlük dışında: ' + esc(INV.unknown.join(', ')) + ' (grup varsayılan ρ ile hesaplandı)' : ''}`) : null,
    qaRow('Fotoğraf kanıtı', nPhoto === NR ? true : `⚠ ${NR - nPhoto} eksik`, `${nPhoto}/${NR} kayıt sahada çekilmiş fotoğraf bağlantısı taşıyor`),
    qaRow('GNSS doğruluk kaydı', (G.n_with_acc ?? 0) > 0 ? true : '⚠ Kaydedilmedi', (G.n_with_acc ?? 0) > 0 ? `${G.n_with_acc}/${G.n ?? NR} kayıtta doğruluk değeri · ortalama ±${trNum(G.mean_acc_m, 1)} m` : `0/${G.n ?? NR} kayıtta accuracy_m değeri var — GNSS hassasiyeti bu sürümde SAYIYLA beyan edilemiyor; park üyeliği poligon testiyle doğrulandı`),
    INV ? qaRow('Envanter tutarlılığı (h/d)', INV.hd_block ? '⛔ Blok' : (INV.hd_fail.length ? '⚠ İnceleme' : true), INV.hd_block ? `Kayıtların ${INV.hd_fail.length}/${INV.n} adedinde boy/çap oranı fiziksel aralık dışında (${QA_LIMITS.HD_MIN}–${QA_LIMITS.HD_MAX}) — SİSTEMİK birim hatası (ölçü birimi çevre olabilir: DBH = çevre/π); yayın düzeltme (0011) uygulanana dek bloklanır` : (INV.hd_fail.length ? `${INV.n - INV.hd_fail.length}/${INV.n} kayıt ${QA_LIMITS.HD_MIN}–${QA_LIMITS.HD_MAX} aralığında · ${INV.hd_fail.length} kayıt sınır dışı (tekil bodur/abartılı birey; noktalar: ${INV.hd_fail.map((x) => 'P' + x.point_id).join(', ')})` : `${INV.n}/${INV.n} kayıt boy/çap oranı ${QA_LIMITS.HD_MIN}–${QA_LIMITS.HD_MAX} aralığında`)) : null,
    INV ? qaRow('Karbon yeniden hesabı', INV.dev_block ? '⛔ Blok' : (INV.dev_fail.length ? '⚠ İnceleme' : true), INV.dev_block ? `${INV.dev_fail.length}/${INV.n} kayıtta saklı karbon, panel denklemiyle yeniden hesabın ±%${QA_LIMITS.CARBON_DEV_PCT} bandı dışında — SİSTEMİK hesap hatası; yayın düzeltme uygulanana dek bloklanır` : (INV.dev_fail.length ? `${INV.n - INV.dev_fail.length}/${INV.n} kayıt panel denklemiyle ±%${QA_LIMITS.CARBON_DEV_PCT} içinde · ${INV.dev_fail.length} kayıt bant dışında (noktalar: ${INV.dev_fail.map((x) => 'P' + x.point_id + ' %' + trNum(x.dev_pct, 0)).join(', ')})` : `${INV.n}/${INV.n} kayıt panel denklemiyle (Chave 2014 + kanonik ρ) ±%${QA_LIMITS.CARBON_DEV_PCT} içinde yeniden üretildi`)) : null,
    qaRow('Konum çiti', (snap.geofence.outside_rows || 0) === 0 ? true : '⚠ Kısmi', `${snap.geofence.verified_rows}/${snap.geofence.total ?? snap.geofence.verified_rows} kayıt poligon içinde`),
    qaRow('Moderasyon', snap.moderation.approved > 0, `${snap.moderation.approved}/${snap.moderation.approved} kayıt onaylı · zaman damgası ${snap.moderation.reviewed}/${snap.moderation.approved}`),
    qaRow('Rapor üretimi', true, `içerik hash'i <code>sha256:${hash.slice(0, 16)}…</code> (canlı doğrulama §7'de)`),
  ].filter(Boolean).join('');

  /* ---- Değerlendirme: yalnız veriden türeyen betimleme ---- */
  const clsPct = (k) => { const c = ((L && L.classes) || []).find((x) => x.key === k); return c ? c.pct : null; };
  const distParts = [];
  for (const [k, label] of [['green', 'yeşil alan'], ['hard', 'sert yüzey'], ['water', 'su'], ['bare', 'açık/çıplak alan'], ['other', 'diğer']]) {
    const v = clsPct(k); if (v != null && v > 0) distParts.push(`${label} %${trNum(v, 1)}`);
  }
  const dominant = (((L && L.classes) || []).slice().sort((a, b) => b.pct - a.pct))[0] || null;
  const grpTot = {};
  for (const s of snap.species) grpTot[s.grp] = (grpTot[s.grp] || 0) + s.carbon_kg;
  const grpShares = Object.entries(grpTot).map(([g, c]) => `${grpTr(g)} türlerde %${trNum(100 * c / (t.carbon_kg || 1), 1)}`).join(', ');
  const evalParas = [
    distParts.length ? `<p>Arazi örtüsü sınıflandırmasına göre analiz alanının ${distParts.join('; ')} şeklinde dağıldığı belirlenmiştir${dominant ? `; baskın sınıf %${trNum(dominant.pct, 1)} pay ile ${esc(dominant.label)} sınıfıdır` : ''}.</p>` : '',
    `<p>Ölçülen ${t.n} bireyin toplam karbon stoku ${ciTxt} olarak hesaplanmış; stokun ${grpShares || 'tek grupta'} biriktiği görülmüştür. Hektar başına karşılık ${t.per_ha_kg == null ? '—' : trNum(t.per_ha_kg / 1000, 3) + ' t/ha'} düzeyindedir.</p>`,
    `<p>Örneklem ${t.n} bireysel ölçüme dayanmaktadır; sonuçlar ölçülen bireylerin toplamını verir ve parkın ölçülmeyen bölümlerine ekstrapole edilmemelidir.</p>`,
    `<p class="qnote">Bu bölüm yalnızca ölçüm ve sınıflandırma sonuçlarından türetilen betimleyici ifadeleri içerir; normatif değerlendirme (ör. “iyi durumda”, “yetersiz”) yapılmamıştır.</p>`,
  ].join('');

  /* ---- Sınırlılıklar ---- */
  const limItems = [
    'Arazi örtüsü sonuçları, kullanılan veri kaynağının mekânsal çözünürlüğü, veri edinim tarihi ve sınıflandırma doğruluğu ile sınırlıdır. 10 m çözünürlükteki veri, küçük ve dar yüzeylerin bağımsız olarak temsil edilmesini her durumda mümkün kılmayabilir.',
    'OSM verileri yardımcı geometrik doğrulama amacıyla kullanılmış olup, eksik veya güncel olmayan OSM geometrileri analiz sonucunun tek başına belirleyicisi değildir.',
    knotted ? `Bu sürümde kullanılan park sınırı ${knotN} kendini kesen segment çifti (düğüm) içermektedir; arazi örtüsü çözümlemesi bu nedenle kalite eşiğini geçememiş ve rapor kapsamı dışında bırakılmıştır. Sınırın uygulamada yeniden çizilmesi (veya OSM poligonuna dönülmesi) önerilir.` : null,
    'Chave ve ark. (2014) pantropikal bir modeldir; Türkiye türleri için bölgesel kalibrasyon gerçekleştirilmemiştir.',
    `Örneklem büyüklüğü (n=${t.n}) sınırlıdır; park geneline ekstrapolasyon, güven aralığı ile birlikte dahi ihtiyatla yorumlanmalıdır.`,
    (G.n_with_acc ?? 0) > 0
      ? `GNSS doğruluğu (±${trNum(G.mean_acc_m, 1)} m) bireysel ağaç konumu için değil, park üyeliği doğrulaması için kullanılmıştır.`
      : 'GNSS alıcı doğruluğu (accuracy_m) bu veri sürümünde kaydedilmemiştir; konumsal doğrulama park poligonu üyelik testiyle sınırlıdır ve bireysel nokta hassasiyeti sayısal olarak beyan edilemez.',
    (INV && INV.hd_block) ? `Envanter kalite kapısı bu sürümde boy/çap oranı denetiminde blok vermiştir (${INV.hd_fail.length}/${INV.n} kayıt); ölçü birimi hatası (çevre değeri çap kolonuna yazılmış olabilir) düzeltilmeden toplam karbon stoku yayımlanmamalıdır.` : null,
    (INV && INV.dev_block) ? `Saklı karbon değerleri ${INV.dev_fail.length}/${INV.n} kayıtta panel denklemiyle yeniden hesabın ±%${QA_LIMITS.CARBON_DEV_PCT} bandı dışındadır; düzeltme (0011) uygulanana dek toplam geçicidir.` : null,
    (INV && INV.n_unknown > 0) ? `${INV.n_unknown} tür adı kanonik sözlük dışında kalmıştır (${INV.unknown.join(', ')}); bu kayıtlarda grup varsayılan odun yoğunluğu kullanılmıştır ve tür düzeyi ρ belirsizliği genişlemiştir.` : null,
    L && L.masked_ha > 0 ? `Analiz alanının ${trNum(L.masked_ha, 2)} ha’lık bölümü bulut/gölge maskesi kapsamındadır; bu alan sınıf dağılımına dahil edilmemiştir.` : null,
  ].filter(Boolean).map((x) => `<li>${x}</li>`).join('');

  /* ---- Rapor geçmişi ---- */
  const hist = [...(M.history || []).map((h) => ({ ...h, cur: false })), { id, date: snap.generated_at.slice(0, 10), note: 'İlk yayımlama', cur: true }];
  const histRows = hist.map((h) => `<tr${h.cur ? ' style="font-weight:700"' : ''}><td><code>${esc(h.id)}</code></td><td>1.0</td><td>${esc(h.date || '—')}</td><td class="tr">${esc(h.note || '')}${h.cur ? ' (bu rapor · geçerli sürüm)' : ''}</td></tr>`).join('');

  /* ---- Atıf ---- */
  const citeTitle = `${P.name} ağaç envanteri ve karbon stoku raporu`;
  /* Yazar bloğu (0012): yayını isteyen kullanıcı YAZARDIR; kurucular ayrıca
   * beyan edilir (DataCite: creators ≠ contributors). */
  const AU = snap.author || {};
  const authorCite = citeName(AU.name);
  const authorPlain = authorCite || 'DendroGeo';
  const citePlain = `${authorPlain} (${snap.generated_at.slice(0, 4)}). ${citeTitle}. DendroGeo Bilimsel Analiz Raporu, ${id} (sürüm ${verTxt}). DendroGeo. ${SITE_ORIGIN}/rapor/${id}/`;
  const bib = `@techreport{${id.toLowerCase().replace(/-/g, '')},
  author    = {${AU.name ? citeName(AU.name) : 'DendroGeo (kurumsal yazar)'}},
  contributor = {Şirin, Nagihan and Şirin, Sinan},
  title     = {${citeTitle}},
  year      = {${snap.generated_at.slice(0, 4)}},
  number    = {${id}},
  version   = {${verTxt}},
  publisher = {DendroGeo},
  url       = {${SITE_ORIGIN}/rapor/${id}/},
  note      = {sha256:${hash.slice(0, 16)}…}
}`;

  /* ---- Makine okur üst veri (DataCite Schema 4.7 desenine yakın; §11 + metadata.json) ---- */
  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'Report',
    name: `${P.name}: Bireysel Ağaç Envanteri ve Toprak Üstü / Toprak Altı Karbon Stoku`,
    alternateName: id,
    reportNumber: id,
    inLanguage: 'tr',
    datePublished: snap.generated_at.slice(0, 10),
    version: verTxt,
    license: 'https://creativecommons.org/licenses/by-nc/4.0/',
    author: AU.name
      ? [{ '@type': 'Person', name: AU.name }]
      : [{ '@type': 'Organization', name: 'DendroGeo' }],
    contributor: [{ '@type': 'Person', familyName: 'Şirin', givenName: 'Nagihan' }, { '@type': 'Person', familyName: 'Şirin', givenName: 'Sinan' }],
    publisher: { '@type': 'Organization', name: 'DendroGeo', url: SITE_ORIGIN },
    url: `${SITE_ORIGIN}/rapor/${id}/`,
    spatialCoverage: { '@type': 'Place', name: `${P.city}, ${P.country}` },
    temporalCoverage: String(dataYear),
    citation: ['https://doi.org/10.5281/zenodo.7254221', 'https://doi.org/10.1111/gcb.12629'],
  };

  /* §4.1 saha protokolü metni VERİDEN türetilir: hangi alanın nasıl
   * kaydedildiği veri tablosundan okunur; bilinmeyen hassasiyet ASLA
   * uydurulmaz (0011 öncesi satır, accuracy_m NULL iken "±0,0 m" basıyordu). */
  const RWS = snap.rows || [];
  const nGirth = RWS.filter((r) => r.girth_cm != null && +r.girth_cm > 0).length;
  const hbRows = RWS.filter((r) => Number.isFinite(+r.height_m) && (+r.height_m * 10) % 1 === 0).length;
  const dbhcTxt = nGirth > 0
    ? `Göğüs çapı (DBH), yerden 1,30 m yükseklikte kaydedilen gövde çevresinden türetilmiştir (DBH = çevre ÷ π; ${nGirth}/${NR} kayıtta ham çevre değeri saklıdır).`
    : 'Göğüs çapı (DBH) yerden 1,30 m yükseklikte ölçülmüş ve doğrudan kaydedilmiştir.';
  const gnssTxt = (G.n_with_acc ?? 0) > 0
    ? ` (kaydedilen doğruluk: ${G.n_with_acc}/${G.n ?? NR} kayıt · ortalama ±${trNum(G.mean_acc_m, 1)} m)`
    : ` — ancak alıcı doğruluk değeri (accuracy_m) bu veri sürümünde kaydedilmediğinden GNSS hassasiyeti sayısal olarak beyan edilememektedir; konumsal doğrulama park poligonu üyelik testiyle sınırlıdır (§7)`;
  const photoTxt = (nPhoto === NR) ? 'zorunlu tutulmuş ve tüm kayıtlarda sağlanmıştır' : `kısmen sağlanmıştır (${nPhoto}/${NR} kayıt)`;
  const lulcMethod = L ? `<p><b>4.4 Arazi örtüsü sınıflandırması.</b> Arazi örtüsü sınıflandırması, park sınırı içerisinde mekânsal çözünürlüğü 10 m olan raster veri (${esc(dataset)}) ile gerçekleştirilmiştir. Sınıflandırma sonuçları park geometrisi ile kesiştirilerek değerlendirilmiş; sınır hücrelerinde alan ağırlıklı hesaplama uygulanmıştır${epsg ? ` (analiz projeksiyonu: ${esc(epsg)})` : ''}. Bulut/gölge gölgesinde kalan hücreler maskelenmiş ve sınıf toplamına dahil edilmemiştir${L.masked_ha > 0 ? ` (bu sürümde ${trNum(L.masked_ha, 2)} ha)` : ''}. Raster kapsama alanı ile park geometrisi alanı arasındaki bağıl fark %0,5 eşiğini aşarsa sonuç YAYINLANMAZ; bu sürümde fark %${trNum(deltaPct ?? 0, 3)} olarak ölçülmüştür (Çizelge 3).</p>` : '';

  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${id} · ${esc(P.name)} — Ağaç Envanteri ve Karbon Stoku Raporu</title>
<meta name="description" content="${esc(P.name)} (${esc(P.city)}) bireysel ağaç envanteri: ${t.n} onaylı ölçüm, toplam karbon ${fmtT(t.ci.mean)} t (%95 GA ${fmtT(t.ci.lo)}–${fmtT(t.ci.hi)}). Yöntem: Chave ve ark. 2014; Monte Carlo belirsizlik; konum çiti doğrulaması; ${esc(dataset)} arazi örtüsü bağlamı.">
<link rel="canonical" href="${SITE_ORIGIN}/rapor/${id}/">
<meta property="og:type" content="article">
<meta property="og:site_name" content="DendroGeo">
<meta property="og:title" content="${id} · ${esc(P.name)} Karbon Stoku Raporu">
<meta property="og:description" content="${t.n} onaylı ölçüm · toplam ${ciTxt} · sha256:${hash.slice(0, 12)}…">
<meta property="og:url" content="${SITE_ORIGIN}/rapor/${id}/">
${L ? '<meta property="og:image" content="' + SITE_ORIGIN + '/rapor/' + id + '/harita.png">' : ''}
<meta name="twitter:card" content="${L ? 'summary_large_image' : 'summary'}">
<link rel="alternate" hreflang="tr" href="${SITE_ORIGIN}/rapor/${id}/">
<link rel="alternate" type="application/json" href="metadata.json" title="Rapor üst verisi (DataCite deseni)">
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>
<style>
:root{--ink:#182420;--mut:#5f6d65;--line:#e6e3d9;--green:#1e6f4b;--leaf:#2f9e44;--gd:#14532d;--tint:#eaf3ec;--amber:#9a4a08;--bg:#f7f6f2;--broad:#e8590c}
*{box-sizing:border-box;margin:0}body{background:var(--bg);color:var(--ink);font:15px/1.7 Georgia,'Times New Roman',serif}
.sans{font-family:system-ui,-apple-system,'Segoe UI',sans-serif}
.wrap{max-width:860px;margin:0 auto;padding:48px 28px 80px;background:#fff;border:1px solid var(--line);border-top:6px solid var(--green)}
.kick{font-family:ui-monospace,Consolas,monospace;font-size:.72rem;letter-spacing:.16em;text-transform:uppercase;color:var(--amber)}
h1{font-size:1.9rem;line-height:1.2;color:var(--gd);margin:10px 0 6px;font-weight:600}
.sub{color:var(--mut);font-size:.95rem;font-style:italic}
.meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin:22px 0;padding:14px;border:1px solid var(--line);border-radius:10px;background:var(--bg);font-family:system-ui,sans-serif;font-size:.78rem}
.meta b{display:block;color:var(--mut);font-size:.66rem;letter-spacing:.12em;text-transform:uppercase}
.meta code{font-family:ui-monospace,Consolas,monospace;font-size:.72rem;word-break:break-all}
.meta .hint{display:block;color:var(--mut);font-size:.64rem;margin-top:2px}
.st{display:inline-block;font-family:system-ui,sans-serif;font-size:.72rem;font-weight:700;padding:2px 10px;border-radius:999px;background:var(--tint);color:var(--green);border:1px solid var(--green)}
.stmt{background:var(--bg);border:1px solid var(--line);border-left:4px solid var(--amber);padding:10px 14px;border-radius:0 8px 8px 0;font-family:system-ui,sans-serif;font-size:.84rem;margin:14px 0}
h2{font-size:1.15rem;color:var(--gd);margin:30px 0 8px;padding-bottom:6px;border-bottom:1px solid var(--line);font-weight:600;break-after:avoid}
h2 .no{font-family:ui-monospace,monospace;color:var(--amber);font-size:.8rem;margin-right:8px}
p{margin:8px 0;text-align:justify}
.tscroll{margin:12px 0}\ntable{width:100%;border-collapse:collapse;margin:0;font-family:system-ui,sans-serif;font-size:.8rem}
th{background:var(--tint);color:var(--gd);text-align:left;padding:8px 10px;font-size:.66rem;letter-spacing:.1em;text-transform:uppercase}
td{padding:8px 10px;border-bottom:1px solid var(--line);font-family:ui-monospace,Consolas,monospace;font-size:.76rem}
td.tr{font-family:Georgia,serif}
td.qok{color:var(--green);font-weight:700}
td.qwarn{color:var(--amber);font-weight:700}
.ci{background:var(--tint);border-left:4px solid var(--green);padding:12px 16px;border-radius:0 10px 10px 0;margin:14px 0;font-family:system-ui,sans-serif;font-size:.86rem}
.verify{border:1px dashed var(--amber);background:#fdf7ee;border-radius:10px;padding:12px 16px;margin:14px 0;font-family:system-ui,sans-serif;font-size:.8rem}
.verify code{font-family:ui-monospace,monospace;font-size:.72rem;word-break:break-all}
.cite{background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:14px 16px;font-size:.86rem;margin:10px 0}
pre{background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:10px;font-family:ui-monospace,Consolas,monospace;font-size:.7rem;overflow:auto;margin:8px 0}
.fig{border:1px solid var(--line);border-radius:10px;padding:10px;margin:12px 0;background:var(--bg);break-inside:avoid}
.fig .cap{font-family:system-ui,sans-serif;font-size:.74rem;color:var(--mut);margin-top:8px}
.brow{display:flex;align-items:center;gap:10px;margin:6px 0;font-family:system-ui,sans-serif;font-size:.78rem}
.brow .bl{width:130px;flex:0 0 auto}
.brow .bar{flex:1;height:12px;border-radius:6px;background:#e9ece8;box-shadow:inset 0 0 0 1px #d3d8d0;overflow:hidden}
.brow .bar i{display:block;height:100%;background:var(--leaf);border-radius:6px}
.brow .bv{width:56px;text-align:right;font-family:ui-monospace,monospace}
.sw{display:inline-block;width:10px;height:10px;border-radius:2px;vertical-align:-1px}
.grp{display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
.qnote{font-family:system-ui,sans-serif;font-size:.78rem;color:var(--mut)}
.lim li{margin:6px 0 6px 18px}
.refs li{margin:8px 0 8px 18px;font-size:.86rem}
.foot{margin-top:36px;padding-top:14px;border-top:1px solid var(--line);font-family:system-ui,sans-serif;font-size:.74rem;color:var(--mut)}
.btnrow{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0;font-family:system-ui,sans-serif}
.btn{background:var(--green);color:#fff;border:0;border-radius:8px;padding:9px 16px;font-size:.8rem;font-weight:700;cursor:pointer;text-decoration:none;display:inline-block}
.btn.g{background:#fff;color:var(--green);border:1.5px solid var(--green)}
@media (max-width:640px){
 /* 0024 · MOBİL v2 (0021'in dersi): tabloyu display:block'a çevirmek
  * thead/tbody'yi AYRI kutulara bölüp kolonları kaydırıyordu; overflow-x:
  * hidden da başlıkları kırpıyordu. Doğru ve basit yöntem: tablo NORMAL
  * kalır, .tscroll kabı YATAY KAYAR; metinler overflow-wrap ile kendi
  * kutusunda kırılır → sayfa gövdesi asla genişlemez, hiçbir şey kaymaz. */
 .wrap{padding:26px 12px 56px;border-left:0;border-right:0}
 h1{font-size:1.42rem}
 h2{font-size:1.05rem}
 .meta{grid-template-columns:1fr;padding:12px;gap:8px}
 .tscroll{overflow-x:auto;-webkit-overflow-scrolling:touch;margin:12px -4px;padding:0 4px}
 table{font-size:.74rem;min-width:520px}
 th,td{padding:6px 7px;overflow-wrap:anywhere;word-break:break-word}
 p,li,.sub,.stmt,.qnote,.fig .cap{overflow-wrap:anywhere}
 pre{font-size:.62rem}
 .btnrow .btn{flex:1 1 100%}
 .kick{font-size:.64rem}
 .verify{font-size:.76rem}
}
@media print{
 /* 0027 · PDF/print dostu (kullanıcı isteği): 🖨 Yazdır / PDF düğmesi zaten
  * künyede; bu blok kağıt çıktısını garanti eder — 0024'ün kaydırma kapları
  * ekranda kolonları kaydırarak çözer ama KAĞITTA KIRPAR; print'te kapak
  * görünür olur, tablo tam genişlik basılır. */
 @page{margin:14mm}
 body{background:#fff}
 /* 0028 · kullanıcı "arka plan grafikleri" KAPALI bassa bile renkler gelsin:
  * rozetler, Şekil 1 çubukları, kart zeminleri otherwise kayboluyordu. */
 *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
 .wrap{border:0;padding:0;max-width:none}
 .btnrow,.verify button{display:none!important}
 .tscroll{overflow:visible!important;margin:8px 0;padding:0}
 table{min-width:0!important;font-size:9.5pt}
 th,td{padding:4px 6px;white-space:normal}
 .fig{break-inside:avoid;page-break-inside:avoid}
 /* 0028 · harita TEK sayfaya sığsın: eskiden figür sayfalara bölünüp yarım
  * boş sayfa bırakıyordu (canlı PDF kanıtı). 182mm + başlık A4'e sığar. */
 .fig img{max-width:100%!important;max-height:182mm!important;width:auto!important;height:auto!important;display:block;margin:0 auto}
 h2,h3{break-after:avoid;page-break-after:avoid}
 tr{break-inside:avoid}
 .meta{background:#fff}
 a{color:inherit;text-decoration:none}
}
</style>
</head>
<body>
<div class="wrap">
<div class="kick">DendroGeo Bilimsel Analiz Raporu · ${id} · sürüm ${verTxt}</div>
<h1>${titleMain}</h1>
<div class="sub">Saha ölçümünden allometrik hesaplama ve 10 m arazi örtüsü sınıflandırmasına uzanan, uçtan uca doğrulanmış park ölçekli analiz</div>

<div class="meta">
 <div><b>Rapor kimliği</b><code>${id}</code><span class="hint">${DGR_TITLE_DEF}</span></div>
 <div><b>Rapor durumu</b><span class="st">Geçerli</span></div>
 <div><b>Analiz konusu</b><code>${esc(subject)}</code></div>
 <div><b>Konum</b><code>${esc(P.city)}, ${esc(P.country)}</code></div>
 <div><b>Analiz tarihi</b><code>${genTr}</code></div>
 <div><b>Analiz sürümü</b><code>${esc(engine)}${engineVer ? ' v' + esc(engineVer) : ''}${appVer ? ' · DendroGeo v' + esc(appVer) : ''}</code></div>
 <div><b>Veri dönemi</b><code>${dataYear} (arazi örtüsü)</code><span class="hint">saha ölçümleri: ${snap.period.from.slice(0, 10)} → ${snap.period.to.slice(0, 10)}</span></div>
 <div><b>Mekânsal çözünürlük</b><code>10 m</code></div>
 <div><b>Park kimliği</b><code>${esc(P.osm_key || '—')} · DB #${P.id}</code></div>
 <div><b>Örneklem</b><code>${t.n} onaylı ölçüm · ${snap.species.length} tür</code></div>
 <div><b>Park alanı</b><code>${trNum(parkHa, 2)} ha (OSM poligonu)</code></div>
 <div><b>Yazar</b><code>${AU.name ? esc(AU.name) : 'DendroGeo (kurumsal)'}</code><span class="hint">${esc(FOUNDERS_LINE)}${AU.name ? '' : ' — istek sahibi adı çözülemedi'}</span></div>
 ${qrUri ? `<div><b>Kalıcı bağlantı (QR)</b><img src="${qrUri}" width="104" height="104" alt="${id} kalıcı rapor adresinin QR kodu" style="border:1px solid var(--line);border-radius:6px;background:#fff"><span class="hint">${esc(REPORT_URL)}</span></div>` : `<div><b>Kalıcı bağlantı</b><code>${esc(REPORT_URL)}</code></div>`}
 <div><b>Lisans</b><code>CC BY-NC 4.0</code></div>
 <div><b>İçerik hash'i</b><code>sha256:${hash.slice(0, 20)}…</code></div>
</div>
<p class="stmt">Bu rapor, DendroGeo analiz sistemi tarafından belirlenen yöntem, veri kaynakları ve kalite kontrol prosedürleri doğrultusunda oluşturulmuştur. Rapor bir akreditasyon veya sertifikasyon belgesi değildir; bulgular, beyan edilen veri kaynakları ve çözümleme sürümü kapsamında geçerlidir.</p>

<h2><span class="no">1</span>Analiz Özeti</h2>
<p>Bu rapor, ${esc(P.name)} sınırları içerisinde gerçekleştirilen ${t.n} bireysel ağaç ölçümüne (göğüs çapı, boy, tür, GNSS konumu ve fotoğraf kanıtı) dayalı toplam karbon stokunu, %95 güven aralığı ve bağımsız doğrulama izleri ile birlikte sunmaktadır. Toplam karbon stoku <b>${ciTxt}</b> olarak hesaplanmış; hektara karşılığı ${t.per_ha_kg == null ? '—' : trNum(t.per_ha_kg / 1000, 3) + ' t/ha'} olarak bulunmuştur. Bütün kayıtlar moderatör onayından geçirilmiştir; park poligonu konum çiti denetiminin kayıt düzeyindeki sonucu §7'de raporlanmıştır.${L ? ` Arazi örtüsü bağlamı ${esc(dataset)} ürünüyle üretilmiş; kalite kontrol sonuçları Çizelge 4'te sunulmuştur.` : ''}</p>

<h2><span class="no">2</span>Analiz Alanı</h2>
<p>Analiz alanı, ${esc(P.city)} (${esc(P.country)}) sınırları içinde yer alan ${esc(P.name)} park sahasıdır. Saha sınırı, ${srcTxt} türetilmiş olup ${trNum(parkHa, 2)} ha alan kaplamaktadır.${GJ ? ` Uygulamada çizili sınır kaydı bir dikdörtgen (${GJ.ring_points} nokta; ${trNum(GJ.ring_area_m2 / 10000, 2)} ha) olduğundan gerçek park sınırı sayılmamış, analiz OpenStreetMap poligonundan yürütülmüştür (ayrıntı §7).` : ''}${knotted ? ` Poligonda <b>${knotN} kendini kesen segment çifti</b> (düğüm) saptanmıştır; bu durum alan hesapları ile raster ayrışımını birbirinden ayırır ve arazi örtüsü çözümlemesinin kalite eşiğine takılmasına yol açar (§7, §9).` : ''} Envanter, ${snap.period.from.slice(0, 10)} – ${snap.period.to.slice(0, 10)} tarihleri arasında ${t.n} ölçüm noktasında gerçekleştirilmiştir${snap.geofence.outside_rows > 0 ? `; kayıtların ${snap.geofence.verified_rows}/${snap.geofence.total} adedi poligon içinde, ${snap.geofence.outside_rows} adedi poligon dışında konumlanmaktadır (ayrıntı §7)` : `; kayıtların tamamı poligon içinde konumlanmaktadır (denetim §7)`}.</p>

<h2><span class="no">3</span>Veri Kaynakları</h2>
<p><b>3.1 Birincil veri.</b> ${esc(dataset)}: Sentinel-1 ve Sentinel-2 füzyonundan üretilmiş küresel arazi örtüsü ürünü; mekânsal çözünürlük 10 m; veri dönemi ${dataYear}; lisans CC BY 4.0. Erişim, STAC kataloğu (Planetary Computer) üzerinden park poligonunu kesen karolar için gerçekleştirilmiştir.</p>
<p><b>3.2 Bütünleyici veri.</b> OpenStreetMap (ODbL): park sınırı geometrisi ile su ve açıkça tanımlanmış sert yüzeylerin geometrik doğrulaması/iyileştirmesi amacıyla kullanılmıştır. <b>OSM verisi raster sınıflandırmanın yerine geçmez:</b> sınıf alanları birincil raster üründen hesaplanır; OSM yalnız sınır geometrisi ve bağımsız kontrol için kullanılır.</p>
<p><b>3.3 Saha verisi.</b> ${t.n} adet DendroGeo saha ölçümü (DBH, boy, tür, GNSS konumu, fotoğraf kanıtı); tümü moderatör onaylıdır. Ölçüm kuralları <i>DendroGeo Saha Protokolü v1</i>'de tanımlıdır.</p>
${L && L.cross ? `<p><b>3.4 Çapraz doğrulama verisi.</b> ${esc(L.cross)}: bağımsız ikinci sınıflandırma kaynağı; grup bazlı uzlaşma §7'de raporlanır${L.crossError ? ` (bu sürümde çapraz karşılaştırma tamamlanamadı: ${esc(L.crossError)})` : ''}.</p>` : ''}

<h2><span class="no">4</span>Yöntem</h2>
<p><b>4.1 Saha protokolü.</b> ${dbhcTxt} Ağaç boyu ${hbRows > 0 ? 'sahada ölçülmüş (kayıt çözünürlüğü 0,1 m)' : '—'}; konum sivil GNSS alıcısıyla kaydedilmiş${gnssTxt}; her kayıt için sahada çekilmiş fotoğraf kanıtı ${photoTxt}.</p>
<p><b>4.2 Biyokütle ve karbon.</b> Toprak üstü biyokütle (AGB), Chave ve ark. (2014) pantropikal allometrik denklemiyle hesaplanmıştır: AGB = 0.0673·(ρ·D²·H)^0.976; burada ρ odun yoğunluğu (g/cm³), D göğüs çapı (cm), H ağaç boyu (m). Toprak altı biyokütle (kök biyokütlesi) AGB×0.26, karbon stoku ise toplam biyokütlenin 0.47 katsayısı ile çarpımı olarak tanımlanmıştır. Tür yoğunluğu bulunmadığında grup varsayılanı (iğne yapraklı / geniş yapraklı) kullanılmış ve Çizelge 1'de beyan edilmiştir.</p>
<p><b>4.3 Belirsizlik.</b> Girdi belirsizlikleri (§4.1) ve allometrik model belirsizliği (%22 değişim katsayısı) Monte Carlo yöntemiyle (n=${snap.mc.N}, sabit tohum=${snap.mc.SEED}) yayılmıştır; model hatası kayıtlar arasında korele kabul edilmiştir, zira aynı denklem tüm kayıtlarda ortak yönde sapma üretir. Güven aralığı, örneklem dağılımının 2.5 ve 97.5 yüzdebirlikleri olarak raporlanmıştır.</p>
${lulcMethod || '<p><b>4.4 Arazi örtüsü sınıflandırması.</b> Bu sürümde arazi örtüsü çözümlemesi yer almamaktadır' + (snap.lulc && snap.lulc.error ? ` (teknik not: ${esc(snap.lulc.error)})` : '') + (knotted ? ` Saptanan neden: sınır poligonundaki ${knotN} kendini kesen segment çifti (düğüm), poligon alanı ile raster kapsama alanını %0,5 eşiğinin üzerinde ayrıştırmaktadır. Sınır düzeltilip yeniden yayımlandığında çözümleme üretilir; bu raporun kimliği değişmez, yeni çözümleme yeni DGR kimliği alır.` : '') + (GJ ? ` Saptanan neden: uygulamada çizili sınır kaydı bir dikdörtgen (${GJ.ring_points} nokta; jeodezik alanı ${trNum(GJ.ring_area_m2 / 10000, 2)} ha) olup künye alanından (${trNum(parkHa, 2)} ha) belirgin biçimde büyüktür; alan dengesi eşiği bu nedenle aşılmıştır. Sınır kaydı düzeltilip (veya OSM poligonuna dönülüp) yeniden yayımlandığında çözümleme üretilir; bu raporun kimliği değişmez, yeni çözümleme yeni DGR kimliği alır.` : '') + '.</p>'}
<p><b>4.5 Doğrulama zinciri.</b> (i) Her kayıt moderatör onayı gerektirir (${snap.moderation.approved}/${snap.moderation.approved} kayıt 'Onaylı' durumundadır; zaman damgalı onay kaydı ${snap.moderation.reviewed}/${snap.moderation.approved}); (ii) ölçüm konumunun park poligonu içinde olması veritabanı tetiği ile zorunlu kılınmıştır (trg_geo_fence; zorunluluk, 0007 geçişinden sonraki kayıtlara uygulanır, önceki kayıtlar için kayıt düzeyindeki denetim sonucu §7'de beyan edilir); (iii) arazi örtüsü çözümlemesinde raster/park alan farkı %0,5 eşiğini aşarsa sonuç yayınlanmaz; (iv) yayınlanan sayfanın içerik bütünlüğü SHA-256 hash'i ile açılışta canlı doğrulanır (§7).</p>

<h2><span class="no">5</span>Nicel Sonuçlar</h2>
<p><b>5.1 Karbon stoku.</b> Çizelge 1 tür bazlı özet istatistikleri, Şekil 1 ise karbon paylarının dağılımını vermektedir.</p>
<div class="tscroll"><table><thead><tr><th>Tür</th><th>Grup</th><th>n</th><th>Ort. DBH (cm)</th><th>Ort. boy (m)</th><th>Karbon (kg)</th><th>Pay</th></tr></thead><tbody>${spRows}</tbody></table></div>
<div class="fig"><div class="sans" style="font-size:.78rem"><b>Şekil 1 — Tür bazlı karbon stoku payları</b> <span class="qnote">(bar rengi taksonomik grubu gösterir: ${sw('#2f9e44')} ibreli · ${sw('#e8590c')} yapraklı · ${sw('#8a928c')} diğer)</span></div>${bars}</div>
<div class="ci">📐 Toplam karbon stoku: <b>${ciTxt}</b> · Monte Carlo n=${snap.mc.N}, tohum=${snap.mc.SEED}, model CV=%${snap.mc.MODEL_CV * 100} (korele). ${t.n === 2 ? 'Örneklem büyüklüğü (n=2) nedeniyle güven aralığı geniştir; değer park geneline ekstrapole edilmemelidir.' : t.n < 10 ? 'Örneklem büyüklüğü sınırlı olduğundan güven aralığı geniş yorumlanmalıdır.' : 'Örneklem büyüklüğü aralığı makul düzeye indirmektedir.'}</div>
${L ? `<p><b>5.2 Arazi örtüsü.</b> Sınıf alanları Çizelge 2'de sunulmuştur; mekânsal dağılım §6'da (Şekil 2) gösterilmektedir.</p>
<div class="tscroll"><table><thead><tr><th>Sınıf</th><th>Alan (ha)</th><th>Pay</th></tr></thead><tbody>${L.classes.map((c) => `<tr><td class="tr">${esc(c.label)}</td><td>${trNum(c.ha, 2)}</td><td>%${trNum(c.pct, 1)}</td></tr>`).join('')}</tbody></table></div>
<p><b>5.3 Alan dengesi.</b> Çizelge 3, park geometrisi ile raster kapsama alanının karşılaştırmasını verir; bu karşılaştırma sonuçların üretilmesinden ÖNCE hesaplama bütünlüğünün kontrol edildiğini belgeler.</p>
<div class="tscroll"><table><thead><tr><th>Büyüklük</th><th>Değer</th></tr></thead><tbody>
<tr><td class="tr">Park geometrisi alanı</td><td>${trNum(parkHa, 2)} ha</td></tr>
<tr><td class="tr">Analiz edilen alan (raster kapsama)</td><td>${covHa != null ? trNum(covHa, 2) + ' ha' : '—'}</td></tr>
<tr><td class="tr">Sınıflandırılan alan</td><td>${clsHa != null ? trNum(clsHa, 2) + ' ha' : '—'}</td></tr>
<tr><td class="tr">Alan farkı</td><td>${diffHa != null ? (diffHa >= 0 ? '+' : '') + trNum(diffHa, 2) + ' ha' : '—'}</td></tr>
<tr><td class="tr">Alan farkı (%)</td><td>${deltaPct != null ? trNum(deltaPct, 3) + ' %' : '—'}</td></tr>
</tbody></table></div>` : ''}

<h2><span class="no">6</span>Harita</h2>
${L ? `<div class="fig"><img src="harita.png" alt="${esc(P.name)} park sahası arazi örtüsü sınıfları haritası; park sınırı ve ölçüm noktaları işaretli" style="width:100%;border-radius:8px"><div class="cap">Şekil 2 — ${esc(L.source)} sınıflandırmasının park poligonu ile tam kesişimi; koyu çizgi park sınırını (OSM), siyah noktalar envanter ölçüm noktalarını gösterir. Çizim, çözümleme motorunun kesintisiz hücre çıktısından birebir ölçekli üretilmiştir; bağlayıcı sayısal değerler Çizelge 2'de ve data.json'dadır. Harita altbilgisi belge kimliğini (${id}), veri kaynağını, çözünürlüğü, projeksiyonu (${esc(epsg || '—')}) ve analiz tarihini taşır: harita tek başına dolaşıma girse bile kaynağı belirlidir.</div></div>` : '<p>Bu sürümde harita üretilmemiştir.</p>'}

<h2><span class="no">7</span>Kalite Kontrol ve Doğrulama</h2>
<p>Sonuçlar üretilmeden önce hesaplamanın bütünlüğü aşağıdaki kontrollerle doğrulanmıştır (Çizelge 4). Kontroller otomatiktir; eşik ihlalinde yayın durdurulur.${(INV && (INV.hd_block || INV.dev_block)) ? ` <b>Bu sürümde envanter kalite kapısı blok durumundadır:</b> ${INV.hd_block ? `boy/çap oranı ${INV.hd_fail.length}/${INV.n} kayıtta fiziksel aralık dışında (sistemik birim hatası; DBH = çevre ÷ π dönüşümü uygulanmamış olabilir)` : ''}${INV.hd_block && INV.dev_block ? '; ' : ''}${INV.dev_block ? `saklı karbon değerleri ${INV.dev_fail.length}/${INV.n} kayıtta panel denklemiyle ±%${QA_LIMITS.CARBON_DEV_PCT} bandı dışında` : ''}. Karbon toplamı bu nedenle GEÇİCİDİR ve düzeltme (0011_inventory_qa.sql) uygulanmadan bilimsel iletişimde KULLANILMAMALIDIR.` : ''}</p>
<div class="tscroll"><table><thead><tr><th>Kontrol</th><th>Sonuç</th><th>Ayrıntı</th></tr></thead><tbody>${qaRows}</tbody></table></div>
<div class="verify">
 <b>Rapor kimliği:</b> <code>${id}</code> · sürüm ${verTxt} · yayın ${snap.generated_at.slice(0, 10)}<br>
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

<h2><span class="no">8</span>Değerlendirme</h2>
${evalParas}

<h2><span class="no">9</span>Sınırlılıklar</h2>
<ul class="lim">
 ${limItems}
</ul>

<h2><span class="no">10</span>Tekrar Üretilebilirlik</h2>
<div class="tscroll"><table><thead><tr><th>Öğe</th><th>Kayıt</th></tr></thead><tbody>
<tr><td class="tr">Analiz sürümü</td><td>${esc(engine)}${engineVer ? ' ' + esc(engineVer) : ' —'}${appVer ? ' · uygulama ' + esc(appVer) : ''}</td></tr>
<tr><td class="tr">Veri seti</td><td>${esc(dataset)}</td></tr>
<tr><td class="tr">Çözünürlük</td><td>10 m</td></tr>
<tr><td class="tr">Park geometrisi</td><td>kayıtlı (<code>${esc(P.osm_key || '—')}</code>; yayın anındaki sınır)</td></tr>
<tr><td class="tr">Analiz yöntemi</td><td>sürüm kontrollü${git ? ` (git commit <code>${esc(String(git).slice(0, 7))}</code>)` : ' (git commit kaydı bu kopyada yok)'}</td></tr>
<tr><td class="tr">Üretim komutu</td><td><code>node scripts/make-report.mjs --park ${P.id}</code></td></tr>
</tbody></table></div>
<p>Bu raporun yeniden üretilebilmesi için kullanılan yöntem, veri kaynağı ve analiz sürümü rapor üst verisinde (<code>metadata.json</code>) kayıt altına alınmıştır. Raster girdi bulut kataloğundan okunduğu için, kaynak ürünün YENİ bir sürümü yayımlanırsa aynı komut farklı sonuç üretebilir; bu nedenle veri seti sürümü (v200, ${dataYear}) ve üretim anı §11'de sabitlenmiştir.</p>

<h2><span class="no">11</span>Analiz Parmak İzi</h2>
<div class="meta">
 <div><b>Analysis ID</b><code>${id}</code></div>
 <div><b>Engine</b><code>${esc(engine)}</code></div>
 <div><b>Engine version</b><code>${engineVer ? esc(engineVer) : '—'}</code></div>
 <div><b>Source dataset</b><code>${esc(dataset)}</code></div>
 <div><b>Resolution</b><code>10 m</code></div>
 <div><b>Projection</b><code>${esc(epsg || '—')}</code></div>
 <div><b>Git commit</b><code>${git ? esc(String(git).slice(0, 7)) : '—'}</code></div>
 <div><b>Generated</b><code>${esc(snap.generated_at)}</code></div>
 <div><b>Result hash</b><code>sha256:${esc(hash)}</code></div>
 <div><b>DOI</b><code>${M.doi ? esc(M.doi) : 'atanmadı'}</code><span class="hint">DOI kaydı (Zenodo/DataCite) yapıldığında 10.xxxx/… değeri buraya ve metadata.json relatedIdentifiers alanına işlenir; DGR iç kimlik olarak kalır.</span></div>
</div>

<h2><span class="no">12</span>Rapor Geçmişi</h2>
<div class="tscroll"><table><thead><tr><th>Rapor</th><th>Sürüm</th><th>Tarih</th><th>İşlem</th></tr></thead><tbody>${histRows}</tbody></table></div>
<p class="qnote">Yayımlanmış rapor içeriği değiştirilemez. Düzeltme gerekirse rapor geri çekilir (yayın panelinde 🗑) ve aynı park için yeni DGR kimliğiyle yeniden yayımlanır; bu tablo zinciri gösterir. Geri çekme işlemleri rapor/yayin-kuyrugu.json günlüğünde ve git geçmişinde saklanır.</p>

<h2><span class="no">13</span>Atıf</h2>
<div class="cite"><b>Önerilen atıf</b><br>${esc(citePlain)}
<div class="sans" style="margin-top:8px;color:var(--mut)">Gerçek DOI kaydı oluşturulduğunda atıfın sonuna <code>https://doi.org/…</code> eklenir; DGR kimliği ve sürüm bilgisi değişmez. Yöntem atıfları: Chave ve ark. (2014) <code>10.1111/gcb.12629</code>${L ? ` · ${esc(L.citation)}` : ''} · OpenStreetMap katkıcıları (ODbL).</div></div>
<pre>${esc(bib)}</pre>

<h2><span class="no">14</span>Kaynakça</h2>
<ol class="refs">
 <li>Zanaga, D., Van De Kerchove, R., De Keersmaecker, W. ve ark. (2022). <i>ESA WorldCover 10 m 2021 v200</i> [veri seti]. Zenodo. <code>10.5281/zenodo.7254221</code> (CC BY 4.0).</li>
 <li>Chave, A., Réjou-Méchain, M., Barbier, N. ve ark. (2014). Pantropikal ağaçlar için geliştirilmiş allometrik biyokütle modelleri. <i>Global Change Biology</i>, 20(10), 3177–3190. <code>10.1111/gcb.12629</code> — §4.2'de kullanılan allometrik denklem.</li>
 <li>OpenStreetMap katkıcıları. <i>OpenStreetMap verisi</i> [park sınırı geometrisi ve bütünleyici doğrulama]. Open Database License (ODbL). https://www.openstreetmap.org/copyright</li>
 ${L && L.cross ? `<li>${esc(L.cross)} [çapraz doğrulama veri seti] — grup bazlı uzlaşma §7'de raporlanmıştır.</li>` : ''}
 <li>Şirin, N. &amp; Şirin, S. (2026). <i>DendroGeo Saha Protokolü v1</i> (DBH, boy, GNSS ve fotoğraf kanıtı kuralları) ve <i>DendroGeo yöntem dokümantasyonu</i>. ${SITE_ORIGIN}/yontem/</li>
</ol>

<h2><span class="no">Ek</span>A — Veri Erişilebilirliği</h2>
<div class="btnrow">
 <a class="btn g" href="olcum.csv">📥 Ölçüm verisi (CSV)</a>
 <a class="btn g" href="park.geojson">🗺 Konumlar (GeoJSON)</a>
 <a class="btn g" href="data.json">🧾 Snapshot (JSON)</a>
 <a class="btn g" href="metadata.json">🏷 Üst veri (JSON)</a>
 ${L ? '<a class="btn g" href="harita.png">🛰 Arazi örtüsü haritası (PNG)</a>' : ''}
 <button class="btn" onclick="window.print()">🖨 Yazdır / PDF</button>
 <button class="btn" id="dgShareBtn" onclick="dgShareReport()">📤 Paylaş</button>
 <a class="btn g" href="../../">🌐 DendroGeo uygulaması</a>
</div>
<p class="sans" style="font-size:.8rem;color:var(--mut)">Ham veriler CC BY-NC 4.0 lisansı ile açıktır; yeniden kullanımda §13 künyesine atıf zorunludur. <code>metadata.json</code>, DataCite desenine yakın makine okur üst veriyi taşır ve DOI kaydına hazırdır.</p>

<div class="foot">DendroGeo · Küresel Ağaç Envanteri ve Karbon Veri Sistemi · ${DGR_TITLE_DEF} · Bu sayfa yayın anında dondurulmuştur; sonraki çözümlemeler yeni DGR kimliği alır, geri çekmeler günlüğe işlenir. Belge tipografisi, uygulama arayüzünden bilinçli olarak ayrışır (rapor = akademik belge). · CC BY-NC 4.0 · © DendroGeo</div>
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
/* PAYLAŞ (2026-09-27 · kullanıcı isteği: rapor site içinden paylaşılacak):
 * Web Share API varsa yerel paylaşım sayfası açılır (mobil/masaüstü); yoksa
 * kalıcı bağlantı panoya kopyalanır. Bağlantı = sayfanın kendi URL'si, yani
 * DGR kimliği + sürüm + içerik hash'i ile dondurulmuş kopya paylaşılır. */
async function dgShareReport(){
  const btn=document.getElementById('dgShareBtn');
  const url=location.href.split('#')[0];
  const title=document.title;
  const sub=document.querySelector('.sub');
  const text=title+(sub?('. '+sub.textContent):'');
  const flash=(m)=>{if(!btn)return;const eski=btn.textContent;btn.textContent=m;setTimeout(()=>{btn.textContent=eski;},2400);};
  try{
    if(navigator.share){await navigator.share({title:title,text:text,url:url});return;}
  }catch(e){/* iptal edildi veya API yok → pano yedeği */}
  try{
    await navigator.clipboard.writeText(url);
    flash('✅ Bağlantı kopyalandı');
  }catch(e){
    window.prompt('Bağlantıyı kopyalayın (Ctrl+C):',url);
  }
}
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
  const rows = list.map((r) => `<tr><td><a href="${r.id}/">${r.id}</a></td><td class="tr">${esc(r.park)}</td><td>${r.n}</td><td>${r.carbon}</td><td>${r.date}</td><td><span class="badge on">Geçerli</span></td></tr>`).join('');
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Yayınlanmış Raporlar — DendroGeo</title>
<meta name="description" content="DendroGeo tarafından yayınlanmış, içerik hash'i ile dondurulmuş park ölçekli bilimsel raporların dizini.">
<link rel="canonical" href="https://dendrogeo.org/rapor/">
<link rel="stylesheet" href="../css/style.css"><link rel="stylesheet" href="../css/ui-standard.css">
</head><body class="dg-page"><header class="top"><div class="wrap nav"><a class="brand" href="../">🌲 DendroGeo</a><nav class="links"><a href="../">Uygulama</a><a href="../yontem/">Yöntem</a></nav></div></header>
<main><div class="wrap"><div class="hero"><div class="tag">BİLİMSEL RAPOR DİZİNİ</div><h1>Yayınlanmış Park Raporları</h1>
<p class="lead">Her rapor yayın anında dondurulur; kimlik (DGR — DendroGeo Bilimsel Analiz Raporu), sürüm ve SHA-256 içerik hash'i ile atanır. Bir raporun verisi değişmez; yeni çözümleme yeni rapor kimliği olarak yayınlanır.</p></div>
<table><thead><tr><th>Rapor</th><th>Park</th><th>n</th><th>Karbon (%95 GA)</th><th>Yayın</th><th>Durum</th></tr></thead><tbody>${rows || '<tr><td colspan=6>Henüz rapor yayınlanmadı.</td></tr>'}</tbody></table>
<p class="lead" style="margin-top:14px;font-size:.85rem">Geri çekilen raporlar bu listeden düşer; geri çekme kayıtları <a href="yayin-kuyrugu.json">yayın günlüğünde</a> gerekçesiyle saklanır ve DGR kimliği yeniden kullanılmaz.</p>
</div></main><footer><div class="wrap">DendroGeo · CC BY-NC 4.0</div></footer></body></html>`;
}

/* Liste yeniden kurulumu: YALNIZ data.json taşıyan dizinler listelenir —
 * geri çekilen raporun data.json'ı silindiği için listeden kendiliğinden
 * düşer. dir parametrik (testler geçici dizinde doğrular). */
export function rebuildIndex(dir = join(ROOT, 'rapor')) {
  if (!existsSync(dir)) return [];
  const list = readdirSync(dir).filter((d) => DGR_ID_RE.test(d)).sort().map((d) => {
    try {
      const j = JSON.parse(readFileSync(join(dir, d, 'data.json'), 'utf8'));
      return { id: d, park: j.park.name, n: j.totals.n, carbon: `${fmtT(j.totals.ci.mean)} t [${fmtT(j.totals.ci.lo)}–${fmtT(j.totals.ci.hi)}]`, date: j.generated_at.slice(0, 10) };
    } catch (e) { return null; }
  }).filter(Boolean);
  writeFileSync(join(dir, 'index.html'), renderIndex(list));
  return list;
}

/* Geri çekme bildirimi (0010): rapor adresi KALIR, içerik kalkar. Bilimsel
 * teamül: sessiz silme yok — gerekçeli, tarihli, kimliği korunmuş bildirim.
 * reason kaçışlanır: günlük/istemci kaynaklı serbest metin HTML'e ham geçmez. */
export function renderRetractionNotice({ id, parkName = '', reason = '', retractedAt = null }) {
  const date = retractedAt ? fmtDateTr(retractedAt) : '—';
  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex, follow">
<title>${esc(id)} — Geri Çekildi · DendroGeo</title>
<link rel="canonical" href="${SITE_ORIGIN}/rapor/${esc(id)}/">
<style>
:root{--ink:#182420;--mut:#5f6d65;--line:#e6e3d9;--green:#1e6f4b;--gd:#14532d;--amber:#9a4a08;--bg:#f7f6f2}
*{box-sizing:border-box;margin:0}body{background:var(--bg);color:var(--ink);font:15px/1.7 Georgia,'Times New Roman',serif}
.wrap{max-width:720px;margin:0 auto;padding:48px 28px 80px;background:#fff;border:1px solid var(--line);border-top:6px solid var(--amber)}
.kick{font-family:ui-monospace,Consolas,monospace;font-size:.72rem;letter-spacing:.16em;text-transform:uppercase;color:var(--amber)}
h1{font-size:1.6rem;color:var(--gd);margin:10px 0 14px;font-weight:600}
table{width:100%;border-collapse:collapse;margin:14px 0;font-family:system-ui,sans-serif;font-size:.82rem}
td{padding:8px 10px;border-bottom:1px solid var(--line)}
td.k{color:var(--mut);font-size:.68rem;letter-spacing:.1em;text-transform:uppercase;width:190px}
p{margin:10px 0;text-align:justify}
code{font-family:ui-monospace,Consolas,monospace;font-size:.78rem;word-break:break-all}
.foot{margin-top:32px;padding-top:12px;border-top:1px solid var(--line);font-family:system-ui,sans-serif;font-size:.74rem;color:var(--mut)}
a{color:var(--green)}
</style>
</head>
<body>
<div class="wrap">
<div class="kick">DendroGeo Bilimsel Analiz Raporu · ${esc(id)}</div>
<h1>Bu rapor geri çekilmiştir</h1>
<table>
<tr><td class="k">Rapor kimliği</td><td><code>${esc(id)}</code></td></tr>
<tr><td class="k">Park</td><td>${esc(parkName || '—')}</td></tr>
<tr><td class="k">Geri çekme tarihi</td><td>${esc(date)}</td></tr>
<tr><td class="k">Gerekçe</td><td>${reason ? esc(reason) : 'Gerekçe belirtilmedi.'}</td></tr>
<tr><td class="k">Durum</td><td><b>Geri çekildi</b> — geçerli sürüm değildir</td></tr>
</table>
<p>Geri çekme, yanlışlıkla yayımlanan veya geçerliliğini yitiren içerik için uygulanan standart işlemdir: raporun veri dosyaları (ölçüm verisi, konumlar, snapshot, harita ve üst veri) yayından kaldırılmış; bu adres bilgilendirme bildirimine dönüştürülmüştür. <b>DGR kimliği kalıcıdır ve yeniden kullanılmaz.</b></p>
<p>Geri çekme kaydı, gerekçesi ve zaman damgasıyla <code>rapor/yayin-kuyrugu.json</code> günlüğünde ve git geçmişinde saklanır. Kaldırılan içeriğe ilişkin talepler (ör. kişisel veri bildirimi) için depo sahibiyle iletişime geçiniz; önceki sürümler git geçmişinde teknik olarak bulunmaya devam edebilir.</p>
<p><a href="../">← Yayınlanmış raporlar dizini</a></p>
<div class="foot">DendroGeo · ${DGR_TITLE_DEF} · © DendroGeo · CC BY-NC 4.0</div>
</div>
</body>
</html>`;
}

/* Makine okur rapor üst verisi (2026-09-28 · kullanıcı standardı md. 12):
 * DataCite Metadata Schema 4.7 alan adlarıyla hizalıdır; Zenodo/DataCite
 * kaydı (Faz 4) bu nesneden türetilir. DOI atanmadığı sürece doi=null ve
 * doiNote alanı doldurulur; atandığında relatedIdentifiers'a IsIdenticalBy
 * ilişkisi eklenir. DGR iç/alan kimliği olarak KALIR. */
export function buildMetadata(snap, { id, hash, version = '1.0', meta = null, history = null }) {
  const M = Object.assign({}, snap.provenance || {}, meta || {});
  const L = (snap.lulc && !snap.lulc.error) ? snap.lulc : null;
  const P = snap.park, t = snap.totals;
  const dataset = (L && L.source) || DATASET_DEFAULT;
  const related = [
    { relationType: 'IsDerivedFrom', relatedIdentifier: '10.5281/zenodo.7254221', relatedIdentifierType: 'DOI', resourceType: 'Dataset', label: dataset },
    { relationType: 'IsDerivedFrom', relatedIdentifier: 'https://www.openstreetmap.org/copyright', relatedIdentifierType: 'URL', resourceType: 'Dataset', label: 'OpenStreetMap (park sınırı geometrisi + bütünleyici doğrulama)' },
    { relationType: 'IsDerivedFrom', relatedIdentifier: '10.1111/gcb.12629', relatedIdentifierType: 'DOI', resourceType: 'Other', label: 'Chave ve ark. (2014) allometrik modeli' },
  ];
  if (M.git_commit) related.push({ relationType: 'IsSupplementedBy', relatedIdentifier: 'https://github.com/snansrin/dendrogeo/commit/' + M.git_commit, relatedIdentifierType: 'URL', resourceType: 'Software', label: 'Üretim kodu (git commit)' });
  for (const h of history || []) related.push({ relationType: 'IsNewVersionOf', relatedIdentifier: h.id, relatedIdentifierType: 'Other', resourceType: 'Report', label: h.note || 'Aynı parkın önceki analizi' });
  return {
    schema: 'dendrogeo-report-metadata/1',
    dataciteCompatibility: 'DataCite Metadata Schema 4.7 alan adlarıyla hizalıdır; DOI kaydı bu nesneden türetilir.',
    identifier: id,
    identifierType: 'DGR',
    identifierDescription: DGR_TITLE_DEF + ' (iç/alan kimliği)',
    title: `${P.name} (${P.city}): Bireysel Ağaç Envanteri ve Toprak Üstü / Toprak Altı Karbon Stoku Analizi`,
    publicationYear: Number(snap.generated_at.slice(0, 4)),
    resourceType: 'Scientific Analysis Report',
    resourceTypeGeneral: 'Report',
    publisher: 'DendroGeo',
    version: String(version),
    language: 'tr',
    license: 'CC-BY-NC-4.0',
    creators: (snap.author && snap.author.name)
      ? [{ name: citeName(snap.author.name), nameType: 'Personal' }]
      : [{ name: 'DendroGeo', nameType: 'Organizational' }],
    creatorsNote: (snap.author && snap.author.name)
      ? 'Rapor, yayını isteyen kullanıcının (veri katkısı sahibinin) adıyla yayımlanır.'
      : 'İstek sahibi adı çözülemedi (v_report_authors boş veya 0012 uygulanmamış) → kurumsal yazar; İSİM UYDURULMAZ.',
    contributors: [{ name: 'Şirin, Nagihan', contributorType: 'Founder', nameType: 'Personal' }, { name: 'Şirin, Sinan', contributorType: 'Founder', nameType: 'Personal' }],
    subjects: [{ subject: 'tree inventory' }, { subject: 'carbon stock' }, { subject: 'land cover' }, { subject: 'urban forestry' }],
    spatialCoverage: `${P.city}, ${P.country}`,
    temporalCoverage: String((L && L.year) || 2021),
    measurementPeriod: `${snap.period.from.slice(0, 10)}/${snap.period.to.slice(0, 10)}`,
    resolution: '10 m',
    methodVersion: `${M.engine || 'DendroGeo LC Engine'}${M.engine_version ? ' ' + M.engine_version : ''}`.trim(),
    projection: epsgLabel((L && L.epsg) || M.epsg || null),
    sampleSize: t.n,
    sources: [dataset, 'OpenStreetMap (ODbL)', 'DendroGeo saha ölçümleri (moderatör onaylı)'],
    relatedIdentifiers: related,
    resultHash: 'sha256:' + hash,
    gitCommit: M.git_commit || null,
    generated: snap.generated_at,
    url: SITE_ORIGIN + '/rapor/' + id + '/',
    doi: (M.doi && /^10\.\d{4,9}\//.test(String(M.doi))) ? String(M.doi) : null,
    doiNote: 'DOI atanmadı. Zenodo/DataCite kaydında bu alan 10.xxxx/… değeriyle doldurulur ve DGR kimliği relatedIdentifiers listesine IsIdenticalBy ilişkisiyle bağlanır.',
    history: [
      ...(history || []).map((h) => ({ id: h.id, version: '1.0', date: h.date || null, status: h.retracted ? 'Geri çekildi' : 'Yerine bu rapor yayımlandı', note: h.note || '' })),
      { id, version: String(version), date: snap.generated_at.slice(0, 10), status: 'Geçerli', note: 'İlk yayımlama' },
    ],
  };
}

/* QR üretimi (qrcode, MIT — devDependency): kalıcı adresin SVG data-URI'si.
 * Hata yayını DURDURMAZ: QR kozmetik bir tamamlayıcıdır, rapor kimliği ve
 * hash doğrulaması ondan bağımsızdır. */
export async function qrDataUri(url) {
  try {
    const svg = await QRlib.toString(String(url), { type: 'svg', errorCorrectionLevel: 'M', margin: 1, width: 104, color: { dark: '#182420', light: '#ffffff' } });
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  } catch (e) { return null; }
}

/* ---------- YAYINLAMA ÇEKİRDEĞİ ----------
 * publishPark() TEK üretim yoludur; iki yerden çağrılır:
 *   · CLI  (node scripts/make-report.mjs --park N) → rapor.yml, elle yayın
 *   · KUYRUK (scripts/publish-queue.mjs)           → rapor-yayin.yml, yani
 *     uygulama içinden basılan "📄 Yayınla" düğmesi (0008_report_publish.sql)
 * Dönüş değeri yayın kimliğini taşır; kuyruk günlüğü (rapor/yayin-kuyrugu.json)
 * bu nesneden yazılır ve uygulamadaki "📄 Bilimsel Rapor Yayını" kartı kalıcı
 * bağlantıyı oradan okur. */
/* Sıradaki DGR kimliği: yıl + dizindeki mevcut kayıt sayısı (basit, çakışmasız:
 * yayın TEK iş parçacığından (Actions concurrency kilidi) yürür). */
export function nextReportId(dir, year) {
  const existing = existsSync(dir) ? readdirSync(dir).filter((d) => d.startsWith('DGR-' + year + '-')).sort() : [];
  return `DGR-${year}-${String(existing.length + 1).padStart(4, '0')}`;
}

/* Aynı parkın önceki yayınları (rapor geçmişi §12 + metadata relatedIdentifiers):
 * kaynak, repo günlüğüdür — geri çekilmiş raporlar NOT'lu gösterilir. */
export function parkHistory(dir, parkId, selfId) {
  try {
    const q = JSON.parse(readFileSync(join(dir, 'yayin-kuyrugu.json'), 'utf8'));
    const es = Array.isArray(q.entries) ? q.entries : [];
    const retracted = new Set(es.filter((e) => e.status === 'Geri çekildi').map((e) => String(e.report_id)));
    return es.filter((e) => e.status === 'Yayınlandı' && Number(e.park_id) === Number(parkId) && String(e.report_id) !== String(selfId))
      .map((e) => ({
        id: String(e.report_id),
        date: String(e.finished_at || '').slice(0, 10),
        retracted: retracted.has(String(e.report_id)),
        note: retracted.has(String(e.report_id)) ? 'Aynı parkın önceki analizi (geri çekildi)' : 'Aynı parkın önceki analizi (bu raporla yenilendi)',
      }));
  } catch (e) { return []; }
}

export async function publishPark(parkId, opts = {}) {
  const year = new Date().getFullYear();
  const dir = join(ROOT, 'rapor');
  mkdirSync(dir, { recursive: true });
  /* Kimlik ÖNCE atanır: snapshot, PNG altbilgisi ve parmak izi aynı DGR'yi
   * taşısın diye meta olarak buildSnapshot'e iner. */
  const id = nextReportId(dir, year);
  const meta = { id, git_commit: GIT_COMMIT, engine_version: ENGINE_VERSION, app_version: APP_VERSION };
  meta.qr_uri = await qrDataUri(SITE_ORIGIN + '/rapor/' + id + '/'); /* künye QR'ı (0012) */
  const { snap, hash, png } = await buildSnapshot(+parkId, { skipLulc: !!opts.skipLulc, meta });
  const version = 1;          /* iç sürüm alanı (sayı) — kuyruk günlüğü bunu taşır */
  const verTxt = '1.0';       /* belge sürümü (gösterim/metadata): her DGR 1.0 doğar */
  const history = parkHistory(dir, snap.park.id, id);
  const out = join(dir, id);
  mkdirSync(out, { recursive: true });
  if (png) writeFileSync(join(out, 'harita.png'), png);
  const html = renderReport(snap, { id, hash, version, meta: Object.assign({}, meta, { history }) });
  writeFileSync(join(out, 'index.html'), html);
  writeFileSync(join(out, 'data.json'), JSON.stringify(snap)); /* 0012: sıkıştırılmış (arşiv boyutu ~%45 küçük) */
  writeFileSync(join(out, 'olcum.csv'), csvOf(snap));
  writeFileSync(join(out, 'park.geojson'), JSON.stringify(geojsonOf(snap), null, 2));
  writeFileSync(join(out, 'metadata.json'), JSON.stringify(buildMetadata(snap, { id, hash, version: verTxt, meta, history })) + '\n'); /* 0012: sıkıştırılmış */
  rebuildIndex();
  const url = SITE_ORIGIN + '/rapor/' + id + '/';
  return {
    id, version, url, path: 'rapor/' + id + '/', hash,
    park_id: snap.park.id, park_name: snap.park.name, city: snap.park.city,
    n: snap.totals.n, carbon_kg: snap.totals.carbon_kg, per_ha_kg: snap.totals.per_ha_kg,
    ci: snap.totals.ci,
    carbon_txt: `${fmtT(snap.totals.ci.mean)} t [%95 GA ${fmtT(snap.totals.ci.lo)}–${fmtT(snap.totals.ci.hi)}]`,
    lulc: snap.lulc ? (snap.lulc.error ? 'hata: ' + snap.lulc.error : 'dahil (' + snap.lulc.source + ')') : 'atlandı',
    generated_at: snap.generated_at,
    report_version: verTxt,
    metadata_path: 'rapor/' + id + '/metadata.json',
    supersedes: history.filter((h) => !h.retracted).map((h) => h.id),
    citation: `${(snap.author && snap.author.name) ? citeName(snap.author.name) : 'DendroGeo'} (${snap.generated_at.slice(0, 4)}). ${snap.park.name} ağaç envanteri ve karbon stoku raporu (${id}, sürüm ${verTxt}). DendroGeo Bilimsel Analiz Raporu. ${url}`,
  };
}

/* ---------- CLI ---------- */
export async function main() {
  if (has('reindex')) {
    const l = rebuildIndex();
    console.log(`✅ rapor/index.html yeniden kuruldu (${l.length} geçerli yayın).`);
    return;
  }
  const parkId = arg('park');
  if (!parkId) { console.error('Kullanım: node scripts/make-report.mjs --park <id> [--skip-lulc] | --reindex'); process.exit(2); }
  const r = await publishPark(parkId, { skipLulc: has('skip-lulc') });
  console.log(`✅ Rapor yayınlandı: ${r.path}`);
  console.log(`   park   : ${r.park_name} (${r.city}) · n=${r.n}`);
  console.log(`   karbon : ${r.carbon_txt}`);
  console.log(`   hash   : sha256:${r.hash}`);
  console.log(`   sürüm  : ${r.report_version}${r.supersedes.length ? ' · yeniler: ' + r.supersedes.join(', ') : ''}`);
  console.log(`   LULC   : ${r.lulc}`);
  console.log(`   üst v. : ${r.metadata_path}`);
  console.log(`   bağlantı: ${r.url}`);
  console.log(`   atıf   : ${r.citation}`);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch((e) => { console.error('❌', e.message); process.exit(1); });
