#!/usr/bin/env node
import { reportRead } from './lib/report-reader.mjs';
import {reportContext} from './lib/report-context.mjs';
import { decodeReportContext } from './lib/report-context.mjs';
import { reviewedSurface } from './surface-report.mjs';
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
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { execSync } from 'node:child_process';
import { mcTotalCI, mcRowCI, MC_CFG, loadRho, loadSpeciesDict, QA_LIMITS, QA_STATE, qaStateOf, DBH_REASON_TR, carbonKg, YASAL_STATU_KAPSAM } from './lib/mc.mjs';
import { canonicalHash } from './lib/canonical-hash.mjs';
import { buildReportProvenance } from './lib/report-provenance.mjs';
import { createReportMetadata } from './lib/report-metadata.mjs';
import { pointInRing, pointInPolygon, ringSelfIntersections, geometrySelfIntersections, bboxRing, ringGeodesicAreaM2 } from './lib/report-geometry.mjs';
export { pointInRing, pointInPolygon, ringSelfIntersections, geometrySelfIntersections, bboxRing, ringGeodesicAreaM2 };
import { reportMeasurementsCsv, reportMeasurementsGeoJson } from './lib/report-export.mjs';
import { DGR_ID_RE, rebuildIndex, nextReportId, parkHistory } from './lib/report-archive.mjs';
export { DGR_ID_RE, rebuildIndex, nextReportId, parkHistory };
import { citeName, fmtDateTr, fmtDateDot, epsgLabel } from './lib/report-formatting.mjs';
export { citeName, fmtDateTr, fmtDateDot, epsgLabel };
import { createRetractionNotice } from './lib/report-retraction.mjs';
import { createQrDataUri } from './lib/report-qr.mjs';
import { resolveReportAuthor } from './lib/report-author.mjs';
import { REPORT_SHARE_SCRIPT } from './lib/report-share.mjs';
import { reportStyles } from './lib/report-style.mjs';
import { summarizeReportMeasurements } from './lib/report-measurement-summary.mjs';
const fmtT = value => trNum(value / 1000, 2);
import { createRequire } from 'node:module';
const require_ = createRequire(import.meta.url);
/* qrcode (MIT) YALNIZ build bağımlılığıdır. Kurulu değilse (örn. npm install
 * çalıştırılmamış ortam) rapor üretimi ÇÖKMEZ: QR hücresi atlanır, kalıcı
 * adres künyede metin olarak kalır. QR kozmetiktir; kimlik/hash ondan
 * bağımsızdır. */
let QRlib = null;
try { QRlib = require_('qrcode'); } catch (e) { QRlib = null; }
export const qrDataUri = createQrDataUri(QRlib);

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

const SB = (() => {
  const s = read('src/config/supabase.js');
  return { url: s.match(/SB_URL="([^"]+)"/)[1], key: s.match(/SB_KEY="([^"]+)"/)[1] };
})();
async function rest(table, params) {
  const u = SB.url + '/rest/v1/' + table + '?' + new URLSearchParams(params);
  const r = await reportRead(u, { headers: { apikey: SB.key, Authorization: 'Bearer ' + SB.key } });
  if (!r.ok) throw new Error(table + ' HTTP ' + r.status);
  return r.json();
}
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const trNum = (x, d = 2) => Number(x).toLocaleString('tr-TR', { minimumFractionDigits: d, maximumFractionDigits: d });

/* ---------- LULC (uygulamanın kendi motoru, vm içinde) ---------- */
export function bootLC() {
  const MODS = ['src/utils/geo.js', 'src/services/park-state.js', 'src/domain/parks/area.js', 'src/domain/parks/segment-intersection.js', 'src/domain/parks/point-in-polygon.js', 'src/domain/parks/bounds.js', 'src/services/park-geometry.js',
    'src/services/lc-config.js', 'src/domain/surface/classify-landcover-code.js',
    'src/domain/surface/compare-source-class-areas.js',
    'src/services/lc-geo.js', 'src/services/lc-stac.js',
    'src/domain/surface/merge-tile-results.js',
    'src/adapters/surface/result-exports.js',
    'src/application/surface/analyze-source.js',
    'src/adapters/surface/process-landcover-tile.js',
    'src/services/lc-engine.js', 'src/services/lc-osm.js', 'src/domain/surface/patch-geometry.js', 'src/domain/surface/group-patch-cells.js', 'src/domain/surface/measure-patch-components.js', 'src/domain/surface/query-green-patches.js', 'src/services/lc-patches.js',
    'src/ui/lc-report.js', 'src/domain/surface/quality-gates.js', 'src/contracts/surface-analysis.js',
    'src/application/surface/run-analysis.js', 'src/services/landcover.js'];
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
/* Rapor haritası PNG sorumluluğu ayrı modülde; eski API korunur. */
export { MAP_TONES, mapCanvas, renderMapPNG } from './lib/report-map.mjs';
import { DATASET_ASCII, MAP_TONES, mapCanvas, renderMapPNG } from './lib/report-map.mjs';

/* Envanter QA çekirdeği ayrı modülde tutulur; eski make-report API'si korunur. */
export { inventoryQa } from './lib/report-inventory-qa.mjs';
import { inventoryQa } from './lib/report-inventory-qa.mjs';

/* ---------- snapshot ---------- */
export async function buildSnapshot(parkId, { skipLulc = false, meta = null, surfaceSnapshot = null } = {}) {
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
  const measurementSummary = summarizeReportMeasurements(rows, park.area_m2, { mcTotalCI, mcRowCI });
  /* Konum çiti denetimi SAYILARLA: her kayıt için gerçek nokta–poligon testi.
   * Daha önce verified_rows = rows.length varsayılıyordu; poligon dışında
   * koordinat taşıyan kayıt varsa rapor bunu beyan etmek zorundadır. */
  if(meta?.study){const v=reportContext.validate(meta.study);if(!v.valid)throw Error('Yayın künyesi geçersiz.');meta.study=v.value;}
  const savedSurface = !skipLulc && surfaceSnapshot ? reviewedSurface(surfaceSnapshot,parkId) : null;
  const OG = savedSurface ? {outer:surfaceSnapshot.outer[0],holes:surfaceSnapshot.holes||[]} : await parkOuter(park).catch(() => null);
  const gfInside = OG ? rows.filter((r) => (savedSurface ? surfaceSnapshot.outer : [OG.outer]).some(outer=>pointInPolygon(+r.lat, +r.lon, outer, OG.holes))).length : null;
  const gfStat = OG ? { inside: gfInside, outside: rows.length - gfInside } : null;
  const ringPts = OG ? (OG.outer.length + (OG.holes || []).reduce((a, h) => a + h.length, 0)) : 0;
  const gjRing = (park.geom_json && Array.isArray(park.geom_json.outer) && park.geom_json.outer[0]) || null;
  const gjBbox = gjRing ? bboxRing(gjRing) : false;
  const geometryQA = OG ? {
    source: savedSurface ? 'Kayıtlı analiz sınırı' : (gjRing && !gjBbox) ? 'parks.geom_json (uygulamada çizilen sınır)' : ('OSM ' + (park.osm_key || '—')),
    ring_points: ringPts,
    ring_area_m2: OG ? Math.round(ringGeodesicAreaM2(OG.outer)) : null,
    self_intersections: ringPts <= 600 ? geometrySelfIntersections(OG.outer, OG.holes) : null,
    /* geom_json bbox ise analiz OSM poligonundan yürür; rapor bunu beyan eder */
    geom_json_bbox_ignored: !savedSurface && gjBbox ? { ring_points: gjRing.length, ring_area_m2: Math.round(ringGeodesicAreaM2(gjRing)) } : null,
  } : null;
  /* Envanter kalite kapısı: kanonik sözlük + panel denklemiyle yeniden hesap */
  const qaSpecies = inventoryQa(rows, loadSpeciesDict());
  /* Yayın provenance'i ölçüm protokolü kilidini aynı kanonik ρ kaynağından okur.
   * Bu değer buildSnapshot kapsamındadır; inventoryQa içindeki yerel değişkene
   * güvenilmez (2026-10-06: "base is not defined" yayın hatası). */
  const rhoBase = loadRho();
  /* YAZAR (0012+0015 · kullanıcı standardı): rapor, PARKIN VERİSİNİ ÖLÇEN
   * kullanıcının adıyla yayımlanır. Öncelik zinciri:
   *   1) dg_park_author(park)  — en çok onaylı katkısı olan kayıt sahibi (0015)
   *   2) v_report_authors      — son yayın isteğini açan kullanıcı (0012)
   *   3) kurumsal "DendroGeo"  — İSİM UYDURULMAZ
   * (DGR-2026-0004 dersi: istek Sinan'dan gelince künyede Sinan yazdı; oysa
   * 34 kaydın sahibi Nagihan. Ölçen kişi istek açandan önceliklidir.) */
  let author = await resolveReportAuthor(parkId, rest);
  let lulc = null;
  if (!skipLulc && surfaceSnapshot) {
    lulc=savedSurface;
    lulc._outer=surfaceSnapshot.outer[0];
    lulc._png=renderMapPNG({outer:surfaceSnapshot.outer[0],outers:surfaceSnapshot.outer,holes:surfaceSnapshot.holes||[],surfaceFeatures:surfaceSnapshot.displayFeatures||surfaceSnapshot.features,classes:lulc.mapClasses,parkName:park.name,sub:'KAYITLI ANALIZ - '+fmtDateDot(surfaceSnapshot.acceptedAt),points:rows.map(r=>({lat:+r.lat,lon:+r.lon})),pointStat:gfStat,meta:{id:meta?.id,epsg:lulc.epsg,dateStr:fmtDateDot(surfaceSnapshot.acceptedAt),source:'UYDU / OSM / KULLANICI KARARI',resolution:'UYDU 10/20 M; VEKTOR SINIR'}});
    delete lulc.mapClasses;
  } else if (!skipLulc) {
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
  if(meta?.study?.author_name)author={name:meta.study.author_name,full_name:meta.study.author_name,source:'publication_context'};
  const snap = {
    ...(meta?.study ? {study:meta.study} : {}),
    schema: 'dendrogeo-report/1',
    park: { id: park.id, name: park.name, osm_key: park.osm_key, city: park.city, country: park.country, area_m2: park.area_m2 },
    generated_at: genAt,
    /* Üretim izi (2026-09-28): §11 Analiz Parmak İzi ve metadata.json buradan
     * okur. Hash bu alanları da kapsar → parmak izi sonradan değiştirilemez. */
    provenance: buildReportProvenance({
      engineVersion: ENGINE_VERSION,
      appVersion: APP_VERSION,
      gitCommit: meta && meta.git_commit,
      fallbackGitCommit: GIT_COMMIT,
      reportId: meta && meta.id,
      measurementProtocol: rhoBase.measurementLockId,
      measurementProtocolFingerprint: rhoBase.measurementLockFingerprint,
      lulc,
      savedSurface,
      datasetDefault: DATASET_DEFAULT,
    }),
    mc: { ...MC_CFG },
    totals: measurementSummary.totals,
    species: measurementSummary.species,
    gps: measurementSummary.gps,
    period: measurementSummary.period,
    moderation: measurementSummary.moderation,
    geofence: {
      policy: 'park poligonu içinde ölçüm zorunlu (trg_geo_fence, 0007)',
      total: rows.length,
      verified_rows: gfInside == null ? rows.length : gfInside,
      outside_rows: gfInside == null ? 0 : rows.length - gfInside,
      polygon_source: savedSurface ? 'Kayıtlı analiz sınırı' : OG ? (park.geom_json && park.geom_json.outer ? 'parks.geom_json' : 'OSM') : 'yok',
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
/* Site kurucuları her raporda beyan edilir (kullanıcı standardı 2026-09-28);
 * yazar DEĞİLDİR — yazar, yayını isteyen kullanıcının kendisidir. */
export const FOUNDERS_LINE = 'Site kurucuları: Nagihan Şirin, Sinan Şirin';
const GROUP_TR = { 'İBRELİ': 'ibreli', 'IBRELI': 'ibreli', 'YAPRAKLI': 'yapraklı', 'DİĞER': 'diğer', 'DIGER': 'diğer' };
/* Şekil 1 bar renkleri (kullanıcı isteği 2026-09-28): ibreli = yeşil,
 * yapraklı = turuncu, diğer = gri. CSS varsayılanı yaprak yeşili kalır. */
const GRP_COLORS = { 'İBRELİ': '#2f9e44', 'IBRELI': '#2f9e44', 'YAPRAKLI': '#e8590c', 'DİĞER': '#8a928c', 'DIGER': '#8a928c' };
const grpColor = (g) => GRP_COLORS[String(g || '')] || '#8a928c';
const grpTr = (g) => GROUP_TR[String(g || '')] || String(g || '').toLowerCase();
export function renderReport(snap, { id, hash, version = 1, meta = null }) {
  const t = snap.totals, P = snap.park;
  const M = Object.assign({}, snap.provenance || {}, meta || {});
  const doi = /^10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+$/.test(String(M.doi || '')) ? String(M.doi) : null;
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
  const resolutionLabel = L?.review ? "Uydu 10/20 m + vektör sınır" : L?.accepted ? "Kayıtlı alan toplamları" : "10 m";
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
  const deltaPct = (L && L.areaDeltaPct != null) ? L.areaDeltaPct : (L?.review && parkHa > 0 && covHa != null ? Math.abs(covHa - parkHa) / parkHa * 100 : null);
  /* ---- Çizelge 4 satırları + üç hâlli durum (0031) + ℹ️ beyan (0032) ----
   * QA durumu TABLODAN türetilir (elle sayılmaz) → rozet ile Çizelge 4 asla
   * çelişmez. ⛔ = kritik hata (blok), ⚠ = inceleme, ✓ = geçerli,
   * ℹ️ = BEYAN (0032): bilgilendirme kalemi, kalite hükmü DEĞİLDİR ve
   * 🟢/🟡/🔴 durumunu ETKİLEMEZ (ör. ρ kaynağı).
   * Gövde formu (boy/çap) ve karbon yeniden hesap bandı YALNIZ ⚠ üretir;
   * DBH geçerlilik kontrolü ile saklı–yeniden hesap tutarsızlığı sistemikse
   * ⛔ üretebilir.
   * 0032 · hücre sınıfları: .qst = sonuç (tek satır, renkli), .qd = ayrıntı
   * (orantılı yazı, kelime ortasından KIRILMAZ) → tablo masaüstü/mobil/PDF
   * üçünde de düzenli görünür. Kontrol kolonu class="tr" olarak KALIR
   * (test/report-v2.test.mjs bu işareti kilitler). */
  const qaStates = [];
  const qaRow = (k, ok, det) => {
    const txt = ok === true ? '✓ Geçerli' : ok === false ? '⚠ Kontrol edilemedi' : ok;
    const s = String(txt);
    const isInfo = s.startsWith('ℹ');
    const cls = ok === true ? 'qok qst' : s.startsWith('⛔') ? 'qbad qst' : isInfo ? 'qinfo qst'
      : (ok === false || s.startsWith('⚠')) ? 'qwarn qst' : 'qst';
    qaStates.push(s.startsWith('⛔') ? 'block' : isInfo ? 'info' : (ok === true ? 'ok' : 'review'));
    return `<tr><td class="tr">${k}</td><td class="${cls}">${txt}</td><td class="qd">${det}</td></tr>`;
  };
  /* Uzun nokta listelerini tabloda okunur tut (PDF/baskı düzeni bozulmasın). */
  const ptList = (arr, cap = 12) => {
    const ids = arr.map((x) => 'P' + x.point_id);
    return ids.length > cap ? ids.slice(0, cap).join(', ') + ` … (+${ids.length - cap} kayıt)` : ids.join(', ');
  };
  /* 0033 · Çizelge 4 ayrıntı metinleri: (b) gövde formu, (c) karbon ρ kaynağı.
   * Hepsi inventoryQa çıktısından TÜRETİLİR; sabit/elle yazılmış sayı yoktur.
   * tN: değeri olmayan hücrede 0 BASMAZ. */
  const tN = (x, d = 1) => (x == null || !Number.isFinite(+x) ? '—' : trNum(x, d));
  const DB = (INV && INV.dbh_stats) || null;
  const HD = (INV && INV.hd_stats) || null;
  const DR = (INV && INV.dev_rho) || null;
  /* 0033 · gövde çapı aralığı metni: envanterden TÜRETİLİR, eşik/statü yok. */
  const govdeAralikTxt = DB ? `${tN(DB.min, 1)}–${tN(DB.max, 1)} cm (medyan ${tN(DB.medyan, 1)} cm, n=${DB.n})` : null;
  const HD_TAIL = INV && INV.h_fail && INV.h_fail.length
    ? ` · ${INV.h_fail.length} kayıtta ağaç boyu fiziksel aralık dışında (${QA_LIMITS.H_MIN_M}–${QA_LIMITS.H_MAX_M} m): ${ptList(INV.h_fail)}`
    : '';
  const hdDetail = !INV ? null : (INV.hd_review
    ? `${INV.n - INV.hd_fail.length}/${INV.n} kayıt gövde formu açısından makul · ${INV.hd_fail.length} kayıt inceleme istiyor (${INV.hd_fail.map((x) => `P${x.point_id}: h/D ${tN(x.hd, 2)}${x.z != null ? `, z ${tN(x.z, 2)}` : ''} — ${x.reason === 'stand-aykiri' ? 'stand içi dağılıma göre aykırı (modified z > ' + trNum(QA_LIMITS.HD_ROBUST_Z, 1) + ')' : 'fiziksel makullük bandı (' + QA_LIMITS.HD_PHYS_MIN + '–' + QA_LIMITS.HD_PHYS_MAX + ') dışı'}`).join('; ')}) — tür, yaş ve gövde formu farklarından kaynaklanabilir; saha ölçümünün hatalı olduğu anlamına GELMEZ ve yayını bloklamaz${HD_TAIL}`
    : `${INV.n}/${INV.n} kayıt boy/çap oranı fiziksel makullük bandında (${QA_LIMITS.HD_PHYS_MIN}–${QA_LIMITS.HD_PHYS_MAX}) ve stand içi robust aykırılık testinde aykırı kayıt YOK (modified z eşiği ${trNum(QA_LIMITS.HD_ROBUST_Z, 1)})`
      + (HD ? ` · stand dağılımı: medyan ${tN(HD.medyan, 2)}, MAD ${tN(HD.mad, 3)}, aralık ${tN(HD.min, 2)}–${tN(HD.max, 2)}, en yüksek |z| ${tN(Math.abs(HD.z_max), 2)}` : '')
      + (INV.hd_band_out && INV.hd_band_out.length
        ? ` · ${INV.hd_band_out.length}/${INV.n} kayıt tipik ${QA_LIMITS.HD_MIN}–${QA_LIMITS.HD_MAX} bandının dışında: bu bir UYARI DEĞİL, BİLGİDİR — bu envanterin boy/çap dağılımı${HD ? ` (medyan ${tN(HD.medyan, 2)})` : ''} tipik orman bandının altında kalıyor; sabit bant karşılaştırması dağılım bilgisidir, kayıt bazlı hata hükmü değildir${govdeAralikTxt ? ` · türetilmiş DBH aralığı ${govdeAralikTxt}` : ''}`
        : '')
      + HD_TAIL);
  const devDetail = !INV ? null : (INV.dev_block
    ? `${INV.dev_fail.length}/${INV.n} kayıtta saklı karbon, FINAL kilitli ρ tablosuyla yeniden hesabın ±%${QA_LIMITS.CARBON_DEV_PCT} bandı dışında — SİSTEMİK hesap bütünlüğü sorunu; yayın düzeltme uygulanana dek bloklanır`
    : (INV.dev_fail.length
      ? `${INV.n - INV.dev_fail.length}/${INV.n} kayıt FINAL kilitli ρ tablosuyla ±%${QA_LIMITS.CARBON_DEV_PCT} içinde · ${INV.dev_fail.length} kayıt bant dışında (${INV.dev_fail.map((x) => `P${x.point_id}: saklı ${tN(x.stored)} kg ↔ beklenen ${tN(x.expected)} kg (%${tN(x.dev_pct)})`).join('; ')}) — tek yetkili hesap yolu budur`
      : `${DR && DR.n ? `${DR.n}/${INV.n} kayıt` : `${INV.n}/${INV.n} kayıt`} panel denklemiyle (Chave 2014 + FINAL kilitli ρ tablosu) ±%${QA_LIMITS.CARBON_DEV_PCT} içinde yeniden üretildi — bant dışı kayıt YOK`
        + (DR && DR.tur ? ` · ${DR.tur} kayıt kilitli tür ρ satırı kullandı` : '')
        + (DR && DR.grup ? ` · ${DR.grup} kayıt yalnız kendi grup genelini kullandı` : '')));

  const qaRows = [
    qaRow('Park geometrisi', knotted ? '⚠ Düğümlü sınır' : (P.osm_key || P.area_m2 > 0 ? true : false),
      `${GQ ? esc(GQ.source) : 'OSM poligonu <code>' + esc(P.osm_key || '—') + '</code>'} · ${trNum(parkHa, 2)} ha` +
      (knotted ? ` · <b>${knotN} kendini kesen segment çifti</b> (düğüm)${L ? '' : ' — arazi örtüsü çözümlemesi bu nedenle QA eşiğine takıldı'}` : knotN === 0 ? ' · kendini kesme yok (tarandı)' : GQ && GQ.self_intersections == null ? ' · düğüm taraması koşulmadı (halka > 600 nokta)' : '')),
    L ? qaRow('Raster kapsama', (L.cells || 0) > 0 && covHa > 0, `${L.cells || 0} kaynak hücre · kapsama ${covHa != null ? trNum(covHa, 2) + ' ha' : '—'}`) : null,
    L ? qaRow('Alan dengesi', deltaPct != null && deltaPct <= 0.5, deltaPct != null ? `raster/park alan farkı %${trNum(deltaPct, 3)} (eşik %0,500)` : '—') : null,
    L ? qaRow('Hücre–kesit hesabı', true, 'tam poligon–hücre kesişimi; sınır hücrelerinde alan ağırlıklı hesap') : null,
    L ? qaRow('Veri kaynağı', !!L.source, `${esc(dataset)} · yıl ${dataYear} · ${esc(resolutionLabel)}`) : null,
    L ? qaRow('Sınıflandırma', (L.classes || []).length > 0, `${(L.classes || []).length} sınıf${L.masked_ha > 0 ? ` · maskeli ${trNum(L.masked_ha, 2)} ha (bulut/gölge)` : ' · maskeli alan yok'}`) : null,
    L && L.agreement ? qaRow('Çapraz doğrulama', true, `${esc(L.cross || 'bağımsız kaynak')} uzlaşması: ${Object.entries(L.agreement).map(([k, v]) => `${esc(k)} %${trNum(v.agreementPct, 0)}`).join(', ')}`) : null,
    INV ? qaRow('Tür/grup kilidi', (INV.n_unknown === 0 && !(INV.group_fail||[]).length) ? true : `⚠ ${INV.n_unknown + (INV.group_fail||[]).length} kayıt uyuşmuyor`, `${INV.n_rows - INV.n_unknown - (INV.group_fail||[]).length}/${INV.n_rows} kayıt FINAL tür/grup sözleşmesiyle eşleşti${INV.unknown.length ? ' · sözlük dışında: ' + esc(INV.unknown.join(', ')) : ''}${(INV.group_fail||[]).length ? ' · yanlış grup: ' + esc((INV.group_fail||[]).map(x=>'P'+x.point_id).join(', ')) : ''}`) : null,
    qaRow('Fotoğraf kanıtı', nPhoto === NR ? true : `⚠ ${NR - nPhoto} eksik`, `${nPhoto}/${NR} kayıt sahada çekilmiş fotoğraf bağlantısı taşıyor`),
    qaRow('GNSS doğruluk kaydı', (G.n_with_acc ?? 0) > 0 ? true : '⚠ Kaydedilmedi', (G.n_with_acc ?? 0) > 0 ? `${G.n_with_acc}/${G.n ?? NR} kayıtta doğruluk değeri · ortalama ±${trNum(G.mean_acc_m, 1)} m` : `0/${G.n ?? NR} kayıtta accuracy_m değeri var — GNSS hassasiyeti bu sürümde SAYIYLA beyan edilemiyor; park üyeliği poligon testiyle doğrulandı`),
    /* (a) Ölçüm protokolü/geçerlilik kontrolü — ham çevre + türetilmiş DBH. */
    INV ? qaRow('Ölçüm protokolü (çevre → DBH)', INV.dbh_block ? '⛔ Blok' : (INV.dbh_fail.length ? '⚠ İnceleme' : true), INV.dbh_fail.length ? `${INV.n - INV.dbh_fail.length}/${INV.n} kayıtta türetilmiş DBH geçerli · ${INV.dbh_fail.length} kayıtta sorun (${INV.dbh_fail.slice(0, 8).map((x) => 'P' + x.point_id + ': ' + (DBH_REASON_TR[x.reason] || x.reason)).join('; ')}${INV.dbh_fail.length > 8 ? '; …' : ''})` : `${INV.n}/${INV.n} kayıtta ham göğüs çevresi korunmuş ve DBH = çevre / π olarak türetilmiştir; türetilmiş DBH ${QA_LIMITS.DBH_MIN_CM}–${QA_LIMITS.DBH_MAX_CM} cm aralığındadır`) : null,
    /* (b) Gövde formu (boy/çap) — 0032: İKİ katmanlı ölçüt. Fiziksel makullük
     * bandı (HD_PHYS_MIN–HD_PHYS_MAX) + stand İÇİ robust aykırılık (modified
     * z-score > HD_ROBUST_Z). Tipik 15–120 bandı dışı kayıtlar yalnız SAYILIR
     * ve bilgilendirme olarak beyan edilir: sabit bant, bütünüyle geniş gövdeli
     * formlu bir standı topluca "olağandışı" ilan ediyordu (Göksu: 32/34).
     * hd_block KALICI false (0031) — bu kalem ASLA bloklamaz. */
    INV ? qaRow('Boy/DBH oranı incelemesi', INV.hd_review ? '⚠ İnceleme' : true, hdDetail) : null,
    /* (c) Karbon yeniden hesabı — DBH tanımından BAĞIMSIZ, ayrı kalite kontrolü.
     * Saklı carbon_kg ile panel denkleminin karşılaştırılmasıdır; birim iddiası
     * içermez (0031). 0032: beklenen değer İKİ ρ kaynağıyla (tür düzeyi ρ ve
     * grup varsayılanı ρ) hesaplanır; saklı değer herhangi biriyle ±%20
     * içindeyse satır geçerlidir ve eşleşen kaynak SAYIYLA beyan edilir.
     * Motor, katsayılar ve saklı değerler DEĞİŞMEZ. */
    INV ? qaRow('Karbon yeniden hesabı', INV.dev_block ? '⛔ Blok' : (INV.dev_fail.length ? '⚠ İnceleme' : true), devDetail) : null,
    /* 0033 · (d) eşik tabanlı gövde sınıfı beyan satırı KALDIRILDI: rapor
     * hiçbir bireyin yasal statüsü hakkında hüküm vermez
     * (bkz. mc.YASAL_STATU_KAPSAM). Gövde çapı dağılımı §5.1 ve §9da
     * BETİMLEYİCİ olarak beyan edilir; eşik veya statü iddiası yoktur. */
    qaRow('Konum çiti', (snap.geofence.outside_rows || 0) === 0 ? true : '⚠ Kısmi', `${snap.geofence.verified_rows}/${snap.geofence.total ?? snap.geofence.verified_rows} kayıt poligon içinde`),
    qaRow('Moderasyon', snap.moderation.approved > 0, `${snap.moderation.approved}/${snap.moderation.approved} kayıt onaylı · zaman damgası ${snap.moderation.reviewed}/${snap.moderation.approved}`),
    qaRow('Rapor üretimi', true, `içerik hash'i <code>sha256:${hash.slice(0, 16)}…</code> (canlı doğrulama §7'de)`),
  ].filter(Boolean).join('');

  /* Üç hâlli rapor QA durumu: Çizelge 4'ün kendisinden türetilir.
   * FINAL: saha çevresi korunur ve DBH=C/π ile türetilir; Göksu benzeri gerçek
   * saha verisi artık ⛔ BLOKLU değil 🟡 İNCELEME / 🟢 GEÇERLİ olur. */
  const QA_ST = qaStateOf({ block: qaStates.includes('block'), review: qaStates.includes('review') });
  const QA_ST_LABEL = { [QA_STATE.BLOCKED]: '🔴 BLOKLU', [QA_STATE.REVIEW]: '🟡 İNCELEME', [QA_STATE.VALID]: '🟢 GEÇERLİ' }[QA_ST];
  const QA_ST_CLASS = { [QA_STATE.BLOCKED]: 'st st-bad', [QA_STATE.REVIEW]: 'st st-warn', [QA_STATE.VALID]: 'st st-ok' }[QA_ST];
  const QA_BLOCKED = QA_ST === QA_STATE.BLOCKED;
  const QA_REVIEW = QA_ST === QA_STATE.REVIEW;
  /* 0032 · İnceleme kalemleri ağaç DEĞERLERİYLE ilgili mi? Değilse rapor bunu
   * açıkça söyler: kullanıcı, kendi ölçümünün şüpheli olduğu izlenimini
   * görmemeli. Örnek: GNSS accuracy_m alanı boşsa kontrol KOŞULAMAZ (⚠) ama
   * DBH/boy/karbon kontrollerinin tümü geçerlidir. */
  const AGAC_DEGER_TEMIZ = !INV || (!INV.dbh_fail.length && !INV.hd_fail.length && !INV.h_fail.length && !INV.dev_fail.length && !INV.n_unknown);
  /* İnceleme/blok kalemlerinin adı — §7 giriş cümlesinde sayıyla beyan edilir. */
  const qaWhy = [];
  if (INV) {
    if (INV.dbh_fail.length) qaWhy.push(`DBH geçerlilik kontrolünde ${INV.dbh_fail.length}/${INV.n} kayıt`);
    if (INV.hd_review) qaWhy.push(`gövde formu (boy/çap) incelemesinde ${INV.hd_fail.length}/${INV.n} kayıt fiziksel makullük bandı dışında veya stand içi aykırı`);
    if (INV.dev_fail.length) qaWhy.push(`karbon yeniden hesabında ${INV.dev_fail.length}/${INV.n} kayıt ±%${QA_LIMITS.CARBON_DEV_PCT} bandı dışında`);
    if (INV.species_review) qaWhy.push(`${INV.n_unknown} tür kanonik sözlük dışında`);
  }
  if ((G.n_with_acc ?? 0) === 0) qaWhy.push('GNSS alıcı doğruluğu (accuracy_m) kaydedilmemiş');
  if ((snap.geofence.outside_rows || 0) > 0) qaWhy.push(`${snap.geofence.outside_rows} kayıt poligon dışında`);
  if (nPhoto < NR) qaWhy.push(`${NR - nPhoto} kayıtta fotoğraf kanıtı eksik`);
  const QA_WHY = qaWhy.join('; ');

  /* ---- Değerlendirme: yalnız veriden türeyen betimleme ---- */
  const clsPct = (k) => { const c = ((L && L.classes) || []).find((x) => x.key === k); return c ? c.pct : null; };
  const distParts = [];
  for (const [k, label] of [['green', 'yeşil alan'], ['hard', 'sert yüzey'], ['building','bina'], ['water', 'su'], ['pool','havuz / süs havuzu'], ['bare', 'açık/çıplak alan'], ['other', 'diğer']]) {
    const v = clsPct(k); if (v != null && v > 0) distParts.push(`${label} %${trNum(v, 1)}`);
  }
  const dominant = (((L && L.classes) || []).slice().sort((a, b) => b.pct - a.pct))[0] || null;
  const grpTot = {};
  for (const s of snap.species) grpTot[s.grp] = (grpTot[s.grp] || 0) + s.carbon_kg;
  const grpShares = Object.entries(grpTot).map(([g, c]) => `${grpTr(g)} türlerde %${trNum(100 * c / (t.carbon_kg || 1), 1)}`).join(', ');
  const evalParas = [
    distParts.length ? `<p>Arazi örtüsü sınıflandırmasına göre analiz alanının ${distParts.join('; ')} şeklinde dağıldığı belirlenmiştir${dominant ? `; baskın sınıf %${trNum(dominant.pct, 1)} pay ile ${esc(dominant.label)} sınıfıdır` : ''}.</p>` : '',
    `<p>Ölçüm kaydı bulunan ${t.n} ağacın toplam karbon stoku ${ciTxt} olarak hesaplanmış; stokun ${grpShares || 'tek grupta'} biriktiği görülmüştür. Ölçüm kaydı bulunan ağaçların karbon toplamının park alanına oranı ${t.per_ha_kg == null ? '—' : trNum(t.per_ha_kg / 1000, 3) + ' t/ha'} değerindedir; bu oran yalnız kayıt kapsamını tanımlar.</p>`,
    `<p>Örneklem ${t.n} ağaç ölçümüne dayanmaktadır; sonuçlar ölçümü yapılan ağaçların toplamını verir ve parkın ölçülmeyen bölümlerine ekstrapole edilmemelidir.</p>`,
    `<p class="qnote">Yüzey sınıfı oranları ile ağaçların karbon stoku arasındaki nedensel ilişki bu veri kapsamıyla test edilmemiştir.</p>`,
  ].join('');

  /* ---- Sınırlılıklar ---- */
  const limItems = [
    'Arazi örtüsü sonuçları, kullanılan veri kaynağının mekânsal çözünürlüğü, veri edinim tarihi ve sınıflandırma doğruluğu ile sınırlıdır. 10 m çözünürlükteki veri, küçük ve dar yüzeylerin bağımsız olarak temsil edilmesini her durumda mümkün kılmayabilir.',
    L?.review ? 'Kayıtlı analizde OSM nesne sınırları ve kullanıcı çizimleri sınıf alanlarını değiştirebilir; kaynak tarihi ve sınır doğruluğu saha doğrulaması gerektirir.' : 'OSM verileri yardımcı geometrik doğrulama amacıyla kullanılmış olup, eksik veya güncel olmayan OSM geometrileri analiz sonucunun tek başına belirleyicisi değildir.',
    knotted ? `Bu sürümde kullanılan park sınırı ${knotN} kendini kesen segment çifti (düğüm) içermektedir; arazi örtüsü çözümlemesi bu nedenle kalite eşiğini geçememiş ve rapor kapsamı dışında bırakılmıştır. Sınırın uygulamada yeniden çizilmesi (veya OSM poligonuna dönülmesi) önerilir.` : null,
    'Chave ve ark. (2014) pantropikal bir modeldir; Türkiye türleri için bölgesel kalibrasyon gerçekleştirilmemiştir.',
    `Envanter ${t.n} kayıtla sınırlıdır. Tüm ağaçların sayıldığına veya olasılıklı örnekleme tasarımının uygulandığına ilişkin kayıt bulunmadığından parkın toplam karbon stoku tahmin edilmemiştir.`,
    (G.n_with_acc ?? 0) > 0
      ? `GNSS doğruluğu (±${trNum(G.mean_acc_m, 1)} m) bireysel ağaç konumu için değil, park üyeliği doğrulaması için kullanılmıştır.`
      : 'GNSS alıcı doğruluğu (accuracy_m) bu veri sürümünde kaydedilmemiştir; konumsal doğrulama park poligonu üyelik testiyle sınırlıdır ve bireysel nokta hassasiyeti sayısal olarak beyan edilemez.',
    /* 0031 · ESKİ cümle: "boy/çap oranı blok verdi; ölçü birimi hatası (çevre
     * değeri çap kolonuna yazılmış olabilir) düzeltilmeden karbon
     * yayımlanmamalıdır" → DBH göğüs çapı (cm) olduğu için bu hüküm geçersizdi
     * ve gerçek saha verisini haksız yere blokluyordu. Yerine inceleme notu.
     * 0032 · ÖLÇÜT DEĞİŞTİ: sabit 15–120 bandı YERİNE (i) fiziksel makullük
     * bandı HD_PHYS_MIN–HD_PHYS_MAX ve (ii) stand İÇİ robust aykırılık
     * (modified z > 3,5). Tipik bant dışı SAYIM yalnız bilgilendirmedir:
     * bütünüyle geniş gövdeli bir standda oran doğal olarak düşüktür ve
     * sabit bant bu standı topluca "olağandışı" ilan ediyordu (32/34). */
    (INV && INV.hd_review) ? `Boy/DBH oranı ${INV.hd_fail.length}/${INV.n} kayıtta fiziksel makullük bandının (${QA_LIMITS.HD_PHYS_MIN}–${QA_LIMITS.HD_PHYS_MAX}) dışında veya stand içi dağılıma göre aykırıdır (modified z eşiği ${trNum(QA_LIMITS.HD_ROBUST_Z, 1)}). Bu oran bir İNCELEME GÖSTERGESİDİR: tür, yaş ve gövde formu farkları oranı doğal olarak değiştirir; saha ölçümünün hatalı olduğu anlamına gelmez ve rapor bu gerekçeyle bloklanmaz. DBH değerleri ham göğüs çevresinden D=C/π ile türetilmiştir; karbon hesabı yuvarlanmamış türetilmiş D ile yürütülmüştür.` : null,
    (INV && !INV.hd_review && INV.hd_band_out && INV.hd_band_out.length) ? `Boy/çap oranı ${INV.hd_band_out.length}/${INV.n} kayıtta tipik ${QA_LIMITS.HD_MIN}–${QA_LIMITS.HD_MAX} bandının dışındadır; bu bir UYARI DEĞİL, dağılım bilgisidir. Ölçüt olarak sabit bant yerine standın kendi dağılımı kullanılmış${HD ? ` (medyan ${tN(HD.medyan, 2)}, MAD ${tN(HD.mad, 3)}, aralık ${tN(HD.min, 2)}–${tN(HD.max, 2)}, en yüksek |z| ${tN(HD.z_max, 2)}; eşik ${trNum(QA_LIMITS.HD_ROBUST_Z, 1)})` : ''} ve hiçbir kayıt aykırı bulunmamıştır. ${DB ? `Oranın düşük kalması ham çevreden türetilen DBH değerleriyle ilgilidir — aralık ${govdeAralikTxt}: paydada büyük bir çap varken boy tipik orman değerlerinde kaldığında oran matematiksel olarak düşer. Bu dağılım tek başına ölçüm hatası kanıtı oluşturmaz.` : ''}` : null,
    /* 0033 · KAPSAM BEYANI (tek kaynak: mc.YASAL_STATU_KAPSAM). Rapor hiçbir
     * birey için yasal statü değerlendirmesi YAPMAZ. 0032deki eşik tabanlı
     * gövde sınıfı beyanı bu yüzden kaldırıldı: envanterde tescilli olmayan
     * bireyler bulunabilir ve bir ölçüm raporu tespit/tescil hükmü taşıyamaz.
     * Ölçülen değerler olduğu gibi modellenir; düzeltme uygulanmaz. */
    YASAL_STATU_KAPSAM,
    /* 0033 · model temsili sınırlılığı: geniş gövdeli bireyler allometrik
     * kalibrasyon örnekleminde düşük ağırlık taşır → belirsizlik geniştir.
     * Sınırlılık VERİDE değil, modelin temsil gücündedir. */
    (INV && DB) ? `<b>Gövde çapı dağılımı ve model temsili.</b> Bu envanterde ham göğüs çevresinden D=C/π ile türetilen DBH aralığı ${govdeAralikTxt}. Ham çevre değiştirilmemiş; allometriye yalnız yuvarlanmamış türetilmiş D uygulanmıştır. Modelin aktarılabilirliği şu sınırlamalara tabidir: kullanılan allometrik model (Chave ve ark. 2014) pantropikal bir kalibrasyon örneklemine dayanır. Sabit model değişim katsayısı, bölgesel kalibrasyon eksikliğini veya büyük çaplı kent ağaçlarına ilişkin model sapmasını ayrıca nicelleştirmez.` : null,
    (INV && INV.dbh_fail.length) ? `DBH geçerlilik kontrolünde ${INV.dbh_fail.length}/${INV.n} kayıt teknik açıdan sorunludur (eksik / sayısal değil / ≤ 0 / cm aralığı dışında); bu kayıtlar ayrıca incelenmelidir.` : null,
    /* 0031 · karbon yeniden hesabı DBH biriminden BAĞIMSIZ ayrı bir kontroldür. */
    (INV && INV.dev_block) ? `Saklı karbon değerleri ${INV.dev_fail.length}/${INV.n} kayıtta panel denklemiyle yeniden hesabın ±%${QA_LIMITS.CARBON_DEV_PCT} bandı dışındadır; bu bir HESAP BÜTÜNLÜĞÜ sorunudur (DBH birimiyle ilgili değildir) ve giderilene dek toplam geçicidir.` : null,
    (INV && INV.dev_review) ? `Karbon yeniden hesabı karşılaştırmasında ${INV.dev_fail.length}/${INV.n} kayıt ±%${QA_LIMITS.CARBON_DEV_PCT} bandı dışındadır. Bu, DBH biriminden bağımsız AYRI bir kalite kontrol kalemidir; ilgili noktalar ayrıca incelenebilir ancak karbon motorunu veya katsayıları değiştirmek için gerekçe oluşturmaz.` : null,
    (INV && INV.n_unknown > 0) ? `${INV.n_unknown} tür adı kanonik sözlük dışında kalmıştır (${INV.unknown.join(', ')}); FINAL kilit bu kayıtlar için karbon hesabına izin vermez.` : null,
    (INV && INV.group_fail && INV.group_fail.length) ? `${INV.group_fail.length} kayıtta tür ile seçilen grup uyuşmamaktadır; FINAL kilit bu kayıtlar için karbon hesabına izin vermez.` : null,
    L && L.masked_ha > 0 ? `Analiz alanının ${trNum(L.masked_ha, 2)} ha’lık bölümü bulut/gölge maskesi kapsamındadır; bu alan sınıf dağılımına dahil edilmemiştir.` : null,
  ].filter(Boolean).map((x) => `<li>${x}</li>`).join('');

  /* ---- Rapor geçmişi ---- */
  const hist = [...(M.history || []).map((h) => ({ ...h, cur: false })), { id, date: snap.generated_at.slice(0, 10), note: 'İlk yayımlama', cur: true }];
  const histRows = hist.map((h) => `<tr${h.cur ? ' style="font-weight:700"' : ''}><td><code>${esc(h.id)}</code></td><td>1.0</td><td>${esc(h.date || '—')}</td><td class="tr">${esc(h.note || '')}${h.cur ? ' (bu rapor · geçerli sürüm)' : ''}</td></tr>`).join('');

  /* ---- Atıf ---- */
  const citeTitle = snap.study?.title || `${P.name} ağaç envanteri ve karbon stoku raporu`;
  /* Yazar bloğu (0012): yayını isteyen kullanıcı YAZARDIR; kurucular ayrıca
   * beyan edilir (DataCite: creators ≠ contributors). */
  const AU = snap.author || {};
  const authorCite = citeName(AU.name);
  const authorPlain = authorCite || 'DendroGeo';
  const citePlain = `${authorPlain} (${snap.generated_at.slice(0, 4)}). ${citeTitle}. DendroGeo Bilimsel Analiz Raporu, ${id} (sürüm ${verTxt}). DendroGeo. ${doi ? 'https://doi.org/' + doi : SITE_ORIGIN + '/rapor/' + id + '/'}`;
  const bib = `@techreport{${id.toLowerCase().replace(/-/g, '')},
  author    = {${AU.name ? citeName(AU.name) : 'DendroGeo (kurumsal yazar)'}},
  contributor = {Şirin, Nagihan and Şirin, Sinan},
  title     = {${citeTitle}},
  year      = {${snap.generated_at.slice(0, 4)}},
  number    = {${id}},
  version   = {${verTxt}},
  publisher = {DendroGeo},
  url       = {${SITE_ORIGIN}/rapor/${id}/},
  ${doi ? 'doi       = {' + doi + '},\n  ' : ''}note      = {sha256:${hash.slice(0, 16)}…}
}`;

  /* ---- Makine okur üst veri (DataCite Schema 4.7 desenine yakın; §11 + metadata.json) ---- */
  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'Report',
    name: snap.study?.title || `${P.name}: Bireysel Ağaç Envanteri ve Toprak Üstü / Toprak Altı Karbon Stoku`,
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
    identifier: doi ? { '@type': 'PropertyValue', propertyID: 'DOI', value: doi } : id,
    citation: [...(L ? ['https://doi.org/10.5281/zenodo.7254221'] : []), 'https://doi.org/10.1111/gcb.12629'],
  };

  /* §4.1 saha protokolü metni VERİDEN türetilir: hangi alanın nasıl
   * kaydedildiği veri tablosundan okunur; bilinmeyen hassasiyet ASLA
   * uydurulmaz (0011 öncesi satır, accuracy_m NULL iken "±0,0 m" basıyordu). */
  const RWS = snap.rows || [];
  /* FINAL ölçüm protokolü: mezura ile çevre ölçülür; DBH çevre/π ile türetilir. */
  const dbhcTxt = 'Sahada mezura ile ağacın yerden 1,30 m yüksekliğindeki <b>göğüs çevresi</b> santimetre (cm) cinsinden ölçülmüştür. Ham çevre <code>girth_cm</code> alanında korunmuş; gerçek göğüs çapı (DBH; <i>Diameter at Breast Height</i>) her kayıt için <b>DBH = çevre / π</b> bağıntısıyla türetilerek <code>dbh_cm</code> alanına yazılmıştır. Allometrik modele ham çevre değil, bu türetilmiş DBH çapı uygulanmıştır.';
  const hbRows = RWS.filter((r) => Number.isFinite(+r.height_m) && (+r.height_m * 10) % 1 === 0).length;
  const gnssTxt = (G.n_with_acc ?? 0) > 0
    ? ` (kaydedilen doğruluk: ${G.n_with_acc}/${G.n ?? NR} kayıt · ortalama ±${trNum(G.mean_acc_m, 1)} m)`
    : ` — ancak alıcı doğruluk değeri (accuracy_m) bu veri sürümünde kaydedilmediğinden GNSS hassasiyeti sayısal olarak beyan edilememektedir; konumsal doğrulama park poligonu üyelik testiyle sınırlıdır (§7)`;
  const photoTxt = (nPhoto === NR) ? 'zorunlu tutulmuş ve tüm kayıtlarda sağlanmıştır' : `kısmen sağlanmıştır (${nPhoto}/${NR} kayıt)`;
  const lulcMethod = L?.accepted ? `<p><b>4.4 Kayıtlı analiz sonucu.</b> ${esc(fmtDateTr(L.accepted_at))} tarihinde kabul edilmiş sınıf alanları yayın isteğinden alınmıştır. Eski kayıt ayrıntılı geometri taşımadığından yeni harita üretilmemiştir. Bu yayın için uydu analizi yeniden çalıştırılmamıştır.</p>` : L?.review ? `<p><b>4.4 Kayıtlı analiz sonucu.</b> ${esc(fmtDateTr(L.review.acceptedAt))} tarihinde kabul edilen analiz, yayın isteğine sabitlenerek aktarılmıştır. Bina ve havuzlar ayrı sınıftır; OSM nesne sınırları ve kullanıcı çizimleri park sınırına kırpılmıştır. Sayısal değerler ve harita aynı kayıtlı geometriden gelir. Uydu verisinin 10/20 m çözünürlük sınırı ile harita geometrilerinin tarih ve doğruluk sınırlamaları geçerlidir; bu kayıt bağımsız saha doğrulaması sayılmaz.</p>` : L ? `<p><b>4.4 Arazi örtüsü sınıflandırması.</b> Arazi örtüsü sınıflandırması, park sınırı içerisinde mekânsal çözünürlüğü 10 m olan raster veri (${esc(dataset)}) ile gerçekleştirilmiştir. Sınıflandırma sonuçları park geometrisi ile kesiştirilerek değerlendirilmiş; sınır hücrelerinde alan ağırlıklı hesaplama uygulanmıştır${epsg ? ` (analiz projeksiyonu: ${esc(epsg)})` : ''}. Bulut/gölge gölgesinde kalan hücreler maskelenmiş ve sınıf toplamına dahil edilmemiştir${L.masked_ha > 0 ? ` (bu sürümde ${trNum(L.masked_ha, 2)} ha)` : ''}. Raster kapsama alanı ile park geometrisi alanı arasındaki bağıl fark %0,5 eşiğini aşarsa sonuç YAYINLANMAZ; bu sürümde fark %${trNum(deltaPct ?? 0, 3)} olarak ölçülmüştür (Çizelge 3).</p>` : '';

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
<style>${reportStyles(id)}</style>
</head>
<body>
<div class="wrap">
<div class="kick">DendroGeo Bilimsel Analiz Raporu · ${id} · sürüm ${verTxt}</div>
<h1>${snap.study?.title ? esc(snap.study.title) : titleMain}</h1>
<div class="sub">Saha ölçümleri, allometrik hesaplama ve ${L?.review ? "kayıtlı yüzey sonucu" : "arazi örtüsü sınıflandırması"} ile park ölçekli analiz</div>

<div class="meta">
 <div><b>Rapor kimliği</b><code>${id}</code><span class="hint">${DGR_TITLE_DEF}</span></div>
 <div><b>Rapor durumu</b><span class="${QA_ST_CLASS}">${QA_ST_LABEL}</span><span class="hint">${QA_ST === QA_STATE.BLOCKED ? 'kritik veri hatası: karbon sonucu bilimsel iletişimde kullanılmamalıdır' : QA_ST === QA_STATE.REVIEW ? 'veri geçerli; bazı istatistiksel kontroller inceleme uyarısı veriyor (§7)' : 'tüm kritik kontroller geçti'}</span></div>
 <div><b>Analiz konusu</b><code>${esc(subject)}</code></div>
 <div><b>Konum</b><code>${esc(P.city)}, ${esc(P.country)}</code></div>
 <div><b>Analiz tarihi</b><code>${genTr}</code></div>
 <div><b>Analiz sürümü</b><code>${esc(engine)}${engineVer ? ' v' + esc(engineVer) : ''}${appVer ? ' · DendroGeo v' + esc(appVer) : ''}</code></div>
 <div><b>Veri dönemi</b><code>${dataYear} (arazi örtüsü)</code><span class="hint">saha ölçümleri: ${snap.period.from.slice(0, 10)} → ${snap.period.to.slice(0, 10)}</span></div>
 <div><b>Mekânsal çözünürlük</b><code>${esc(resolutionLabel)}</code></div>
 <div><b>Park kimliği</b><code>${esc(P.osm_key || '—')} · DB #${P.id}</code></div>
 <div><b>Örneklem</b><code>${t.n} onaylı ölçüm · ${snap.species.length} tür</code></div>
 <div><b>Park alanı</b><code>${trNum(parkHa, 2)} ha (OSM poligonu)</code></div>
 <div><b>Yazar</b><code>${AU.name ? esc(AU.name) : 'DendroGeo (kurumsal)'}</code><span class="hint">${esc(FOUNDERS_LINE)}${AU.name ? '' : ' — istek sahibi adı çözülemedi'}</span></div>
 ${qrUri ? `<div><b>Kalıcı bağlantı (QR)</b><img src="${qrUri}" width="104" height="104" alt="${id} kalıcı rapor adresinin QR kodu" style="border:1px solid var(--line);border-radius:6px;background:#fff"><span class="hint">${esc(REPORT_URL)}</span></div>` : `<div><b>Kalıcı bağlantı</b><code>${esc(REPORT_URL)}</code></div>`}
 <div><b>Lisans</b><code>CC BY-NC 4.0</code></div>
 <div><b>İçerik hash'i</b><code>sha256:${hash.slice(0, 20)}…</code></div>
</div>
${snap.study ? `<div class="meta" aria-label="Akademik çalışma künyesi">${Object.entries({project_name:'Proje',study_type:'Çalışma türü',institution:'Üniversite / kurum',department:'Fakülte / bölüm',program:'Program / çalışma alanı',advisor:'Danışman',orcid:'ORCID',funding:'Destek / proje numarası',start_date:'Beyan edilen saha başlangıcı',end_date:'Beyan edilen saha bitişi'}).filter(([k])=>snap.study[k]).map(([k,l])=>`<div${k==='project_name'?' class="meta-wide"':''}><b>${esc(l)}</b><code>${esc(snap.study[k])}</code></div>`).join('')}${snap.study.independent ? '<div><b>Kurumsal bağ</b><code>Bağımsız çalışma</code></div>' : ''}</div><p><b>Çalışmanın amacı ve kapsamı.</b> ${esc(snap.study.purpose)}</p>${snap.study.sampling ? '<p><b>Örnekleme tasarımı.</b> '+esc(snap.study.sampling)+'</p>' : ''}${snap.study.instruments ? '<p><b>Saha yöntemi ve ölçüm cihazları.</b> '+esc(snap.study.instruments)+'</p>' : ''}` : ''}
<p class="stmt">Bu rapor, DendroGeo analiz sistemi tarafından belirlenen yöntem, veri kaynakları ve kalite kontrol prosedürleri doğrultusunda oluşturulmuştur. Rapor bir akreditasyon veya sertifikasyon belgesi değildir; bulgular, beyan edilen veri kaynakları ve çözümleme sürümü kapsamında geçerlidir.</p>

<h2><span class="no">1</span>Analiz Özeti</h2>
<p>Bu rapor, ${esc(P.name)} sınırları içerisinde gerçekleştirilen ${t.n} bireysel ağaç ölçümüne (göğüs çevresi, türetilmiş DBH, boy, tür, GNSS konumu ve fotoğraf kanıtı) dayalı karbon stoku tahminini, %95 model belirsizlik aralığı ve veri kalite kontrol sonuçları ile sunar. Ölçümü yapılan ağaçların toplam karbon stoku <b>${ciTxt}</b> olarak hesaplanmıştır. Kayıtlı karbon toplamının park alanına oranı ${t.per_ha_kg == null ? '—' : trNum(t.per_ha_kg / 1000, 3) + ' t/ha'} değerindedir; bu oran, parkın toplam karbon stok yoğunluğu tahmini değildir. Bütün kayıtlar moderatör onayından geçirilmiştir; park poligonu konum çiti denetiminin kayıt düzeyindeki sonucu §7'de raporlanmıştır.${L ? ` Yüzey örtüsü verisi ${esc(dataset)} kaynağından alınmış; kalite kontrol sonuçları Çizelge 4'te sunulmuştur.` : ''}</p>

<h2><span class="no">2</span>Analiz Alanı</h2>
<p>Analiz alanı, ${esc(P.city)} (${esc(P.country)}) sınırları içinde yer alan ${esc(P.name)} park sahasıdır. Saha sınırı, ${srcTxt} türetilmiş olup ${trNum(parkHa, 2)} ha alan kaplamaktadır.${GJ ? ` Uygulamada çizili sınır kaydı bir dikdörtgen (${GJ.ring_points} nokta; ${trNum(GJ.ring_area_m2 / 10000, 2)} ha) olduğundan gerçek park sınırı sayılmamış, analiz OpenStreetMap poligonundan yürütülmüştür (ayrıntı §7).` : ''}${knotted ? ` Poligonda <b>${knotN} kendini kesen segment çifti</b> (düğüm) saptanmıştır; bu durum alan hesapları ile raster ayrışımını birbirinden ayırır ve arazi örtüsü çözümlemesinin kalite eşiğine takılmasına yol açar (§7, §9).` : ''} Envanter, ${snap.period.from.slice(0, 10)} – ${snap.period.to.slice(0, 10)} tarihleri arasında ${t.n} ölçüm noktasında gerçekleştirilmiştir${snap.geofence.outside_rows > 0 ? `; kayıtların ${snap.geofence.verified_rows}/${snap.geofence.total} adedi poligon içinde, ${snap.geofence.outside_rows} adedi poligon dışında konumlanmaktadır (ayrıntı §7)` : `; kayıtların tamamı poligon içinde konumlanmaktadır (denetim §7)`}.</p>

<h2><span class="no">3</span>Veri Kaynakları</h2>
${L?.accepted ? `<p><b>3.1 Birincil veri.</b> ${esc(fmtDateTr(L.accepted_at))} tarihli kabul edilmiş yüzey alanları, kayıt sürümü ${esc(L.revision||"—")}.</p>` : L?.review ? `<p><b>3.1 Birincil veri.</b> Yayın isteğindeki kayıtlı analiz; kabul tarihi ${esc(fmtDateTr(L.review.acceptedAt))}. Kullanılan sahneler: ${esc((L.review.scenes||[]).filter(s=>s.usedCells>0).map(s=>s.datetime).join(", ")||"uydu taraması yok")}. Nesne sınırları: © OpenStreetMap contributors (ODbL) ve kullanıcı çizimleri. Kayıt geometrileri <a href="surface.geojson">GeoJSON</a> olarak indirilebilir.</p>` : `<p><b>3.1 Birincil veri.</b> ${esc(dataset)}: Sentinel-1 ve Sentinel-2 füzyonundan üretilmiş küresel arazi örtüsü ürünü; mekânsal çözünürlük 10 m; veri dönemi ${dataYear}; lisans CC BY 4.0. Erişim, STAC kataloğu (Planetary Computer) üzerinden park poligonunu kesen karolar için gerçekleştirilmiştir.</p>`}
${L?.accepted ? `<p><b>3.2 Bütünleyici veri.</b> Bu eski kayıt sınıf alanlarını taşır; nesne geometrileri ve uydu sahne ayrıntıları kayıtlı değildir.</p>` : L?.review ? `<p><b>3.2 Bütünleyici veri.</b> OpenStreetMap bina, su, havuz ve açıkça tanımlanmış sert zemin sınırları ile kullanıcı çizimleri, kayıtlı analizde raster hücrelerini keserek ayrı yüzey alanları oluşturur. Çakışan çizimlerde son kullanıcı düzeltmesi önceliklidir. Harita tarihi, eksik nesneler ve konumsal doğruluk sonucu sınırlayabilir.</p>` : `<p><b>3.2 Bütünleyici veri.</b> OpenStreetMap (ODbL): park sınırı geometrisi ile su ve açıkça tanımlanmış sert yüzeylerin geometrik doğrulaması/iyileştirmesi amacıyla kullanılmıştır. <b>OSM verisi raster sınıflandırmanın yerine geçmez:</b> sınıf alanları birincil raster üründen hesaplanır; OSM yalnız sınır geometrisi ve bağımsız kontrol için kullanılır.</p>`}
<p><b>3.3 Saha verisi ve kapsam.</b> ${t.n} adet DendroGeo saha ölçümü (göğüs çevresi, türetilmiş DBH, boy, tür, GNSS konumu, fotoğraf kanıtı); tümü moderatör onaylıdır. Kayıt kapsamı, onaylı ölçümlerle sınırlıdır; tam sayım veya olasılıklı örnekleme tasarımına ilişkin ek bilgi bulunmamaktadır. Ölçüm değişkenleri §4.6'da tanımlanmıştır.</p>
${L && L.cross ? `<p><b>3.4 Çapraz doğrulama verisi.</b> ${esc(L.cross)}: bağımsız ikinci sınıflandırma kaynağı; grup bazlı uzlaşma §7'de raporlanır${L.crossError ? ` (bu sürümde çapraz karşılaştırma tamamlanamadı: ${esc(L.crossError)})` : ''}.</p>` : ''}

<h2><span class="no">4</span>Yöntem</h2>
<p><b>4.1 Saha protokolü.</b> ${dbhcTxt} Ağaç boyu ${hbRows > 0 ? 'sahada ölçülmüş (kayıt çözünürlüğü 0,1 m)' : '—'}; konum sivil GNSS alıcısıyla kaydedilmiş${gnssTxt}; her kayıt için sahada çekilmiş fotoğraf kanıtı ${photoTxt}.</p>
<p><b>4.2 Biyokütle ve karbon.</b> Hesaplama zinciri: <b>göğüs çevresi C (cm) → DBH çapı D=C/π (cm) → boy H (m) → odun yoğunluğu (ρ) → AGB → BGB → karbon → belirsizlik.</b> Toprak üstü biyokütle (AGB), Chave ve ark. (2014) pantropikal allometrik denklemiyle hesaplanmıştır: AGB = 0.0673·(ρ·D²·H)^0.976. Burada <b>D, mezurayla ölçülen çevrenin π'ye bölünmesiyle türetilmiş DBH çapıdır</b>; ham çevre hiçbir aşamada doğrudan D olarak kullanılmaz. Toprak altı biyokütle AGB×0.26, karbon stoku ise toplam biyokütlenin 0.47 katsayısı ile çarpımıdır. Odun yoğunluğu yalnız kilitli DendroGeo yoğunluk tablosundan çözülür.</p>
<p><b>4.3 Belirsizlik.</b> Girdi belirsizlikleri (§4.1) ve allometrik model belirsizliği (%22 değişim katsayısı) Monte Carlo yöntemiyle (n=${snap.mc.N}, sabit tohum=${snap.mc.SEED}) yayılmıştır; model hatası kayıtlar arasında korele kabul edilmiştir, zira aynı denklem tüm kayıtlarda ortak yönde sapma üretir. Aralık sınırları Monte Carlo dağılımının 2,5 ve 97,5 yüzdelikleridir. Bu aralık model ve girdi belirsizlikleri koşulunda hesaplanmıştır; olasılıklı örnekleme tasarımına dayalı park geneli güven aralığı değildir.</p>
${lulcMethod || '<p><b>4.4 Arazi örtüsü sınıflandırması.</b> Bu sürümde arazi örtüsü çözümlemesi yer almamaktadır' + (snap.lulc && snap.lulc.error ? ` (teknik not: ${esc(snap.lulc.error)})` : '') + (knotted ? ` Saptanan neden: sınır poligonundaki ${knotN} kendini kesen segment çifti (düğüm), poligon alanı ile raster kapsama alanını %0,5 eşiğinin üzerinde ayrıştırmaktadır. Sınır düzeltilip yeniden yayımlandığında çözümleme üretilir; bu raporun kimliği değişmez, yeni çözümleme yeni DGR kimliği alır.` : '') + (GJ ? ` Saptanan neden: uygulamada çizili sınır kaydı bir dikdörtgen (${GJ.ring_points} nokta; jeodezik alanı ${trNum(GJ.ring_area_m2 / 10000, 2)} ha) olup künye alanından (${trNum(parkHa, 2)} ha) belirgin biçimde büyüktür; alan dengesi eşiği bu nedenle aşılmıştır. Sınır kaydı düzeltilip (veya OSM poligonuna dönülüp) yeniden yayımlandığında çözümleme üretilir; bu raporun kimliği değişmez, yeni çözümleme yeni DGR kimliği alır.` : '') + '.</p>'}
<p><b>4.5 Doğrulama zinciri.</b> (i) Her kayıt moderatör onayı gerektirir (${snap.moderation.approved}/${snap.moderation.approved} kayıt 'Onaylı' durumundadır; zaman damgalı onay kaydı ${snap.moderation.reviewed}/${snap.moderation.approved}); (ii) ölçüm konumunun park poligonu içinde olması veritabanı tetiği ile zorunlu kılınmıştır (trg_geo_fence; zorunluluk, 0007 geçişinden sonraki kayıtlara uygulanır, önceki kayıtlar için kayıt düzeyindeki denetim sonucu §7'de beyan edilir); (iii) arazi örtüsü çözümlemesinde raster/park alan farkı %0,5 eşiğini aşarsa sonuç yayınlanmaz; (iv) yayınlanan sayfanın içerik bütünlüğü SHA-256 hash'i ile açılışta canlı doğrulanır (§7).</p>
<p><b>4.6 Veri sözlüğü.</b> Raporda ve <code>data.json</code>/<code>olcum.csv</code> çıktılarında kullanılan değişkenlerin anlamı ve birimi aşağıdadır.</p>
<div class="tscroll"><table><thead><tr><th>Değişken</th><th>Açıklama</th><th>Birim</th></tr></thead><tbody>
<tr><td class="tr">Göğüs çevresi (C)</td><td class="qd">Mezura ile yerden 1,30 m yükseklikte ölçülen ham gövde çevresi (<code>girth_cm</code>)</td><td class="qd">cm</td></tr>
<tr><td class="tr">DBH (D)</td><td class="qd">Türetilmiş göğüs çapı: <b>D = C / π</b> (<code>dbh_cm</code>)</td><td class="qd">cm</td></tr>
<tr><td class="tr">Boy (H)</td><td class="qd">Ağaç boyu</td><td class="qd">m</td></tr>
<tr><td class="tr">ρ (rho)</td><td class="qd">Odun yoğunluğu (tür bazlı; bulunamazsa grup varsayılanı)</td><td class="qd">g/cm³</td></tr>
<tr><td class="tr">AGB</td><td class="qd">Toprak üstü biyokütle</td><td class="qd">kg</td></tr>
<tr><td class="tr">BGB</td><td class="qd">Toprak altı (kök) biyokütlesi = AGB × 0,26</td><td class="qd">kg</td></tr>
<tr><td class="tr">Karbon</td><td class="qd">Tahmini karbon stoku = (AGB + BGB) × 0,47</td><td class="qd">kg C</td></tr>
<tr><td class="tr">GA</td><td class="qd">%95 model belirsizlik aralığı (Monte Carlo, korele model hatası)</td><td class="qd">kg C</td></tr>
<tr><td class="tr">h/DBH</td><td class="qd">Boy/çap oranı — yalnız inceleme göstergesi, hata hükmü değildir</td><td class="qd">birimsiz</td></tr>
</tbody></table></div>
<p class="qnote"><b>Ölçüm notu:</b> Sahada doğrudan çap ölçülmemiştir. Mezura ile 1,30 m yükseklikte göğüs çevresi ölçülmüş; DBH çapı her kayıt için <b>çevre / π</b> ile türetilmiştir. Allometrik modele yalnız türetilmiş DBH uygulanır; ham çevre ayrıca saklanır.</p>

<h2><span class="no">5</span>Nicel Sonuçlar</h2>
<p><b>5.1 Karbon stoku.</b> Çizelge 1 tür bazlı özet istatistikleri, Şekil 1 ise karbon paylarının dağılımını vermektedir.</p>
<div class="tscroll"><table><caption>Çizelge 1. Türlere göre ağaç envanteri ve karbon stoku.</caption><thead><tr><th>Tür</th><th>Grup</th><th>n</th><th>Ort. DBH (cm)</th><th>Ort. boy (m)</th><th>Karbon (kg)</th><th>Pay</th></tr></thead><tbody>${spRows}</tbody></table></div>
<div class="fig"><div class="sans" style="font-size:.78rem"><b>Şekil 1 — Tür bazlı karbon stoku payları</b> <span class="qnote">(bar rengi taksonomik grubu gösterir: ${sw('#2f9e44')} ibreli · ${sw('#e8590c')} yapraklı · ${sw('#8a928c')} diğer)</span></div>${bars}</div>
<div class="ci">📐 Toplam karbon stoku: <b>${ciTxt}</b> · Monte Carlo n=${snap.mc.N}, tohum=${snap.mc.SEED}, model CV=%${snap.mc.MODEL_CV * 100} (korele). ${'Aralık, belirtilen model ve girdi belirsizliklerini kapsar; parkın ölçülmeyen ağaçlarından kaynaklanan örnekleme belirsizliğini kapsamaz.'}</div>
<p class="qnote"><b>Ölçüm notu:</b> Ham saha değişkeni göğüs çevresidir; DBH = çevre / π ile türetilmiştir (değişken tanımları: §4.6 veri sözlüğü). ${govdeAralikTxt ? ` <b>Türetilmiş DBH aralığı:</b> ${govdeAralikTxt}. Ham çevre değerleri korunmuş, yalnız matematiksel çevre→çap dönüşümü uygulanmıştır (§9 sınırlılıklar).` : ''}</p>
${L ? `<p><b>5.2 Arazi örtüsü.</b> Sınıf alanları Çizelge 2'de sunulmuştur; mekânsal dağılım §6'da (Şekil 2) gösterilmektedir.</p>
<div class="tscroll"><table class="summary"><caption>Çizelge 2. Park sınırı içindeki yüzey sınıflarının alanları.</caption><thead><tr><th>Sınıf</th><th>Alan (ha)</th><th>Pay</th></tr></thead><tbody>${L.classes.map((c) => `<tr><td class="tr">${esc(c.label)}</td><td>${trNum(c.ha, 2)}</td><td>%${trNum(c.pct, 1)}</td></tr>`).join('')}</tbody></table></div>
<p><b>5.3 Alan dengesi.</b> Çizelge 3, park geometrisi ile raster kapsama alanının karşılaştırmasını verir; bu karşılaştırma sonuçların üretilmesinden önce hesaplama bütünlüğünün kontrol edildiğini belgeler.</p>
<div class="tscroll"><table class="summary"><caption>Çizelge 3. Park alanı ve sınıflandırılmış yüzey alanı dengesi.</caption><thead><tr><th>Büyüklük</th><th>Değer</th></tr></thead><tbody>
<tr><td class="tr">Park geometrisi alanı</td><td>${trNum(parkHa, 2)} ha</td></tr>
<tr><td class="tr">Analiz edilen alan (raster kapsama)</td><td>${covHa != null ? trNum(covHa, 2) + ' ha' : '—'}</td></tr>
<tr><td class="tr">Sınıflandırılan alan</td><td>${clsHa != null ? trNum(clsHa, 2) + ' ha' : '—'}</td></tr>
<tr><td class="tr">Alan farkı</td><td>${diffHa != null ? (diffHa >= 0 ? '+' : '') + trNum(diffHa, 2) + ' ha' : '—'}</td></tr>
<tr><td class="tr">Alan farkı (%)</td><td>${deltaPct != null ? trNum(deltaPct, 3) + ' %' : '—'}</td></tr>
</tbody></table></div>` : ''}

<h2><span class="no">6</span>Harita</h2>
${L ? `<div class="fig"><img src="harita.png" alt="${esc(P.name)} park sahası arazi örtüsü sınıfları haritası; park sınırı ve ölçüm noktaları işaretli" style="width:100%;border-radius:8px"><div class="cap">Şekil 2 — ${esc(L.source)} sınıflandırmasının park poligonu ile tam kesişimi; koyu çizgi park sınırını (OSM), siyah noktalar envanter ölçüm noktalarını gösterir. ${L.review?(L.review.displayFeatures?"Raster sınırları ortak kenarları koruyan görsel genelleştirme ile çizilmiştir; bina, yol ve kullanıcı sınırları korunur. Alanlar kesin kabul geometrisinden hesaplanır;":"Çizim, kabul edilmiş kayıt geometrilerinden üretilmiştir;"):"Çizim, çözümleme motorunun kesintisiz hücre çıktısından birebir ölçekli üretilmiştir;"} bağlayıcı sayısal değerler Çizelge 2'de ve data.json'dadır. Harita altbilgisi belge kimliğini (${id}), veri kaynağını, çözünürlüğü, projeksiyonu (${esc(epsg || '—')}) ve analiz tarihini taşır: kaynak bilgileri harita çıktısında da korunur.</div></div>` : '<p>Bu sürümde harita üretilmemiştir.</p>'}

<h2><span class="no">7</span>Kalite Kontrol ve Doğrulama</h2>
<p>Sonuçlar üretilmeden önce hesaplamanın bütünlüğü aşağıdaki kontrollerle doğrulanmıştır (Çizelge 4). Kontroller otomatiktir. Rapor QA durumu üç hâllidir: <b>🔴 BLOKLU</b> — kritik veri hatası vardır, karbon sonucu bilimsel iletişimde kullanılmamalıdır; <b>🟡 İNCELEME</b> — veri geçerlidir, bazı istatistiksel kontroller inceleme uyarısı vermektedir; <b>🟢 GEÇERLİ</b> — tüm kritik kontroller geçmiştir. <b>Bu raporun QA durumu: ${QA_ST_LABEL}</b>${QA_BLOCKED ? ` — kritik hata: ${QA_WHY}. Karbon toplamı bu nedenle GEÇİCİDİR ve hata giderilmeden bilimsel iletişimde KULLANILMAMALIDIR.` : (QA_REVIEW ? ` — inceleme kalemleri: ${QA_WHY}. Bu uyarılar birer inceleme kalemidir; veri hatası hükmü DEĞİLDİR ve karbon sonucunun geçerliliğini ortadan kaldırmaz.${AGAC_DEGER_TEMIZ ? ' Bu rapordaki inceleme kalemlerinin HİÇBİRİ ağaç ölçüm değerleriyle (DBH, boy, tür, karbon) ilgili DEĞİLDİR: envanter kontrollerinin tümü geçerlidir; kalan kalem/kalemler ölçülemeyen veya kaydedilmeyen üst veri alanlarıdır (ör. GNSS alıcı doğruluğu accuracy_m boş bırakılmışsa bu kontrol koşamaz).' : ''}` : '')}${qaStates.includes('info') ? ' Çizelge 4’te ayrıca <b>ℹ️ BEYAN</b> işaretli bilgilendirme satırları bulunabilir: bunlar bir kalite hükmü DEĞİLDİR ve rapor durumunu etkilemez.' : ''} Karbon hesabı, sahada ölçülen göğüs çevresinden D=C/π ile türetilen yuvarlanmamış DBH (cm) değerleri kullanılarak gerçekleştirilmiştir; rapor tablolarında DBH 1 ondalık basamakla gösterilir.</p>
<!-- 0032 · Çizelge 4 düzeni: sabit kolon genişlikleri (colgroup) + .qd ayrıntı hücresi.
     Eski hâlde ayrıntı kolonu monospace ve overflow-wrap:anywhere idi; uzun Türkçe
     cümleler kelime ortasından kırılıp tabloyu şekilsiz gösteriyordu. -->
<div class="tscroll"><table class="qa"><colgroup><col class="ck"><col class="cs"><col class="cd"></colgroup><thead><tr><th>Kontrol</th><th>Sonuç</th><th>Ayrıntı</th></tr></thead><tbody>${qaRows}</tbody></table></div>
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
<tr><td class="tr">Analiz sürümü</td><td class="qd">${esc(engine)}${engineVer ? ' ' + esc(engineVer) : ' —'}${appVer ? ' · uygulama ' + esc(appVer) : ''}</td></tr>
<tr><td class="tr">Veri seti</td><td class="qd">${esc(dataset)}</td></tr>
<tr><td class="tr">Çözünürlük</td><td class="qd">${esc(resolutionLabel)}</td></tr>
<tr><td class="tr">Park geometrisi</td><td class="qd">kayıtlı (<code>${esc(P.osm_key || '—')}</code>; yayın anındaki sınır)</td></tr>
<tr><td class="tr">Analiz yöntemi</td><td class="qd">sürüm kontrollü${git ? ` (git commit <code>${esc(String(git).slice(0, 7))}</code>)` : ' (git commit kaydı bu kopyada yok)'}</td></tr>
<tr><td class="tr">Üretim komutu</td><td class="qd">${L?.review ? "Yayın isteğine sabitlenen analiz: data.json ve surface.geojson" : `<code>node scripts/make-report.mjs --park ${P.id}</code>`}</td></tr>
</tbody></table></div>
${L?.review ? `<p>Yeniden üretim girdileri <code>data.json</code> dosyasında sabitlenmiştir. Uydu sahne kimlikleri, kabul zamanı, sınıf alanları ve nesne geometrileri bu kayıtla korunur. <code>surface.geojson</code>, kabul edilmiş yüzey geometrilerini içerir. Canlı veri kaynağının yeniden sorgulanması aynı veri kümesini garanti etmez; tekrar analiz için bu arşiv girdileri kullanılmalıdır.</p>` : `<p>Bu raporun yeniden üretilebilmesi için kullanılan yöntem, veri kaynağı ve analiz sürümü rapor üst verisinde (<code>metadata.json</code>) kayıt altına alınmıştır. Raster girdi bulut kataloğundan okunduğu için, kaynak ürünün yeni bir sürümü yayımlanırsa aynı komut farklı sonuç üretebilir; bu nedenle veri seti sürümü (v200, ${dataYear}) ve üretim anı §11'de sabitlenmiştir.</p>`}


<h2><span class="no">11</span>Analiz Parmak İzi</h2>
<div class="meta">
 <div><b>Analysis ID</b><code>${id}</code></div>
 <div><b>Engine</b><code>${esc(engine)}</code></div>
 <div><b>Engine version</b><code>${engineVer ? esc(engineVer) : '—'}</code></div>
 <div><b>Source dataset</b><code>${esc(dataset)}</code></div>
 <div><b>Resolution</b><code>${esc(resolutionLabel)}</code></div>
 <div><b>Projection</b><code>${esc(epsg || '—')}</code></div>
 <div><b>Git commit</b><code>${git ? esc(String(git).slice(0, 7)) : '—'}</code></div>
 <div><b>Generated</b><code>${esc(snap.generated_at)}</code></div>
 <div><b>Result hash</b><code>sha256:${esc(hash)}</code></div>
 <div><b>DOI</b>${doi ? '<a href="https://doi.org/' + esc(doi) + '">' + esc(doi) + '</a>' : '<code>atanmadı</code>'}</div>
</div>

<h2><span class="no">12</span>Rapor Geçmişi</h2>
<div class="tscroll"><table><thead><tr><th>Rapor</th><th>Sürüm</th><th>Tarih</th><th>İşlem</th></tr></thead><tbody>${histRows}</tbody></table></div>
<p class="qnote">Bu çizelge aynı parkın üretim yayınlarını gösterir. Test yayınları sürüm zincirine dahil edilmemiştir. Veri veya yöntem değişiklikleri yeni rapor kimliği ve sürüm kaydıyla yayımlanır.</p>

<h2><span class="no">13</span>Atıf</h2>
<div class="cite"><b>Önerilen atıf</b><br>${esc(citePlain)}
<div class="sans" style="margin-top:8px;color:var(--mut)">Yöntem kaynakları: Chave ve ark. (2014) <code>10.1111/gcb.12629</code>${L ? ` · ${esc(L.citation)}` : ''} · OpenStreetMap katkıcıları (ODbL).</div></div>
<pre>${esc(bib)}</pre>

<h2><span class="no">14</span>Kaynakça</h2>
<ol class="refs">
 ${L?.review || L?.accepted ? `<li>Copernicus Sentinel-2 Level-2A [uydu görüntüleri]. Kullanılan sahne kimlikleri ve edinim tarihleri <code>data.json</code> dosyasında kayıtlıdır.</li>` : ''}
 <li>Zanaga, D., Van De Kerchove, R., De Keersmaecker, W. ve ark. (2022). <i>ESA WorldCover 10 m 2021 v200</i> [veri seti]. Zenodo. <code>10.5281/zenodo.7254221</code> (CC BY 4.0).</li>
 <li>Chave, J., Réjou-Méchain, M., Búrquez, A. ve ark. (2014). Improved allometric models to estimate the aboveground biomass of tropical trees. <i>Global Change Biology</i>, 20(10), 3177–3190. <code>10.1111/gcb.12629</code> — §4.2'de kullanılan allometrik denklem.</li>
 <li>OpenStreetMap katkıcıları. <i>OpenStreetMap verisi</i> [park sınırı geometrisi ve bütünleyici doğrulama]. Open Database License (ODbL). https://www.openstreetmap.org/copyright</li>
 ${L && L.cross ? `<li>${esc(L.cross)} [çapraz doğrulama veri seti] — grup bazlı uzlaşma §7'de raporlanmıştır.</li>` : ''}
 <li>Şirin, N. &amp; Şirin, S. (2026). <i>DendroGeo Saha Protokolü v1</i> (göğüs çevresi, DBH = çevre/π, boy, GNSS ve fotoğraf kanıtı kuralları) ve <i>DendroGeo yöntem dokümantasyonu</i>. ${SITE_ORIGIN}/yontem/</li>
</ol>

<h2><span class="no">Ek</span>A — Veri Erişilebilirliği</h2>
<div class="btnrow">
 <a class="btn g" href="olcum.csv">📥 Ölçüm verisi (CSV)</a>
 <a class="btn g" href="park.geojson">🗺 Konumlar (GeoJSON)</a>
 <a class="btn g" href="data.json">🧾 Snapshot (JSON)</a>
 <a class="btn g" href="metadata.json">🏷 Üst veri (JSON)</a>
 ${L ? '<a class="btn g" href="harita.png">🛰 Arazi örtüsü haritası (PNG)</a>' : ''}
 ${M.pdf_path ? '<a class="btn g" href="rapor.pdf">📄 Rapor (PDF)</a>' : ''}
 <button class="btn" onclick="window.print()">🖨 Yazdır / PDF</button>
 <button class="btn" id="dgShareBtn" onclick="dgShareReport()">📤 Paylaş</button>
 <a class="btn g" href="../../">🌐 DendroGeo uygulaması</a>
</div>
<p class="sans" style="font-size:.8rem;color:var(--mut)">Ham veriler CC BY-NC 4.0 lisansı ile açıktır; yeniden kullanımda §13 künyesine atıf zorunludur. <code>metadata.json</code>, DataCite desenine yakın makine okur üst veriyi taşır ve DOI kaydına hazırdır.</p>

<div class="foot">DendroGeo · Küresel Ağaç Envanteri ve Karbon Veri Sistemi · ${DGR_TITLE_DEF} · Bu sayfa yayın anında dondurulmuştur; sonraki çözümlemeler yeni DGR kimliği alır, geri çekmeler günlüğe işlenir. CC BY-NC 4.0 · © DendroGeo</div>
</div>
<script>
// Printed documents use textual status labels; screen icons are restored after printing.
let dgPrintText=[];
window.addEventListener('beforeprint',()=>{const root=document.querySelector('.wrap');if(!root)return;const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;while(node=walker.nextNode()){if(['SCRIPT','STYLE'].includes(node.parentElement?.tagName))continue;const clean=node.textContent.replace(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF\uFE0F]/gu,'');if(clean!==node.textContent){dgPrintText.push([node,node.textContent]);node.textContent=clean;}}});
window.addEventListener('afterprint',()=>{for(const [node,text]of dgPrintText)node.textContent=text;dgPrintText=[];});
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
${REPORT_SHARE_SCRIPT}
</script>
</body>
</html>`;
}

/* ---------- CSV / GeoJSON / liste ---------- */
/* Geri çekme bildirimi ayrı şablon modülündedir; eski API korunur. */
export const renderRetractionNotice = createRetractionNotice({ siteOrigin: SITE_ORIGIN, reportTitle: DGR_TITLE_DEF });

/* Makine okur rapor üst verisi: üretim sabitleri make-report adapter'ında bağlanır;
 * alanların saf üretimi scripts/lib/report-metadata.mjs içindedir. */
export function buildMetadata(snap, options) {
  return createReportMetadata(snap, options, {
    datasetDefault: DATASET_DEFAULT,
    siteOrigin: SITE_ORIGIN,
    reportTitle: DGR_TITLE_DEF,
    epsgLabel,
    trNum,
    legalStatusScope: YASAL_STATU_KAPSAM,
    qaLimits: QA_LIMITS,
    qaState: QA_STATE,
  });
}

/* ---------- YAYINLAMA ÇEKİRDEĞİ ----------
 * publishPark() TEK üretim yoludur; iki yerden çağrılır:
 *   · CLI  (node scripts/make-report.mjs --park N) → rapor.yml, elle yayın
 *   · KUYRUK (scripts/publish-queue.mjs)           → rapor-yayin.yml, yani
 *     uygulama içinden basılan "📄 Yayınla" düğmesi (0008_report_publish.sql)
 * Dönüş değeri yayın kimliğini taşır; kuyruk günlüğü (rapor/yayin-kuyrugu.json)
 * bu nesneden yazılır ve uygulamadaki "📄 Bilimsel Rapor Yayını" kartı kalıcı
 * bağlantıyı oradan okur. */
export async function publishPark(parkId, opts = {}) {
  const validation=reportContext.validate(opts.study);if(!validation.valid)throw Error('Yayın künyesi gerekli: '+Object.values(validation.errors).join(' '));opts={...opts,study:validation.value};
  const year = new Date().getFullYear();
  const dir = join(ROOT, 'rapor');
  mkdirSync(dir, { recursive: true });
  /* Kimlik ÖNCE atanır: snapshot, PNG altbilgisi ve parmak izi aynı DGR'yi
   * taşısın diye meta olarak buildSnapshot'e iner. */
  const id = nextReportId(dir, year);
  const meta = { id, git_commit: GIT_COMMIT, engine_version: ENGINE_VERSION, app_version: APP_VERSION, ...(opts.study ? {study:opts.study} : {}) };
  meta.qr_uri = await qrDataUri(SITE_ORIGIN + '/rapor/' + id + '/'); /* künye QR'ı (0012) */
  const { snap, hash, png } = await buildSnapshot(+parkId, { skipLulc: !!opts.skipLulc, meta, surfaceSnapshot: opts.surfaceSnapshot || null });
  const version = 1;          /* iç sürüm alanı (sayı) — kuyruk günlüğü bunu taşır */
  const verTxt = '1.0';       /* belge sürümü (gösterim/metadata): her DGR 1.0 doğar */
  const history = parkHistory(dir, snap.park.id, id);
  const out = join(dir, id);
  mkdirSync(out, { recursive: true });
  if (png) writeFileSync(join(out, 'harita.png'), png);
  if(snap.lulc?.review)writeFileSync(join(out,'surface.geojson'),JSON.stringify({type:'FeatureCollection',features:snap.lulc.review.features}));
  const html = renderReport(snap, { id, hash, version, meta: Object.assign({}, meta, { history }) });
  writeFileSync(join(out, 'index.html'), html);
  writeFileSync(join(out, 'data.json'), JSON.stringify(snap)); /* 0012: sıkıştırılmış (arşiv boyutu ~%45 küçük) */
  writeFileSync(join(out, 'olcum.csv'), reportMeasurementsCsv(snap, mcRowCI));
  writeFileSync(join(out, 'park.geojson'), JSON.stringify(reportMeasurementsGeoJson(snap), null, 2));
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
  const publicationFile=arg('publication-file');if(!publicationFile)throw Error('Yayın künyesi gerekli: --publication-file künye.json');const study=decodeReportContext(readFileSync(publicationFile,'utf8'));if(!study)throw Error('Geçerli yayın künyesi gerekli.');
  const r = await publishPark(parkId, { skipLulc: has('skip-lulc'), study });
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
