#!/usr/bin/env node
import {createReportPublicationApplication} from './lib/report-publication-application.mjs';
import {createReportSpeciesPresentation, sw} from './lib/report-species-presentation.mjs';
import {createReportQaPresentation} from './lib/report-qa-presentation.mjs';
import {createReportEvaluationPresentation} from './lib/report-evaluation-presentation.mjs';
import {createReportProvenancePresentation} from './lib/report-provenance-presentation.mjs';
import {createReportMapPresentation} from './lib/report-map-presentation.mjs';
import {createReportOverviewPresentation} from './lib/report-overview-presentation.mjs';
import {createReportCoverPresentation} from './lib/report-cover-presentation.mjs';
import {createReportStudyPresentation} from './lib/report-study-presentation.mjs';
import {createReportDocumentHead} from './lib/report-document-head.mjs';
import {createReportSourcesPresentation} from './lib/report-sources-presentation.mjs';
import {createReportHistoryPresentation} from './lib/report-history-presentation.mjs';
import {createReportQaTable} from './lib/report-qa-table.mjs';
import {createReportInventoryDetails} from './lib/report-inventory-details.mjs';
import {createReportQaExplanation} from './lib/report-qa-explanation.mjs';
import {createReportMethodPresentation} from './lib/report-method-presentation.mjs';
import {createReportCitationPresentation} from './lib/report-citation-presentation.mjs';
import {createReportLimitationsPresentation} from './lib/report-limitations-presentation.mjs';
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
import {readReportRuntimeProvenance} from './lib/report-runtime-provenance.mjs';
import { buildReportProvenance } from './lib/report-provenance.mjs';
import { createReportMetadata } from './lib/report-metadata.mjs';
import { pointInRing, pointInPolygon, ringSelfIntersections, geometrySelfIntersections, bboxRing, ringGeodesicAreaM2 } from './lib/report-geometry.mjs';
export { pointInRing, pointInPolygon, ringSelfIntersections, geometrySelfIntersections, bboxRing, ringGeodesicAreaM2 };
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
const renderCitationPresentation = createReportCitationPresentation({citeName, siteOrigin: SITE_ORIGIN});
const arg = (a) => { const i = process.argv.indexOf('--' + a); return i >= 0 ? process.argv[i + 1] : null; };
const has = (a) => process.argv.includes('--' + a);

/* Rapor parmak izi sabitleri (2026-09-28 · kullanıcı standardı): motor sürümü
 * lc-config'den (tek doğruluk kaynağı), uygulama sürümü package.json'dan,
 * git commit üretim anındaki depodan okunur. Değer yoksa null → rapor '—'
 * basar; ASLA uydurulmaz. */
const {engineVersion:ENGINE_VERSION, appVersion:APP_VERSION, gitCommit:GIT_COMMIT} = readReportRuntimeProvenance({
  read, readGitCommit:()=>execSync('git rev-parse HEAD', {cwd:ROOT, encoding:'utf8', stdio:['ignore','pipe','ignore']})
});
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
  const MODS = ['src/utils/geo.js', 'src/services/park-state.js', 'src/domain/parks/area.js', 'src/domain/parks/segment-intersection.js', 'src/domain/parks/point-in-polygon.js', 'src/domain/parks/bounds.js', 'src/domain/parks/park-containment.js', 'src/domain/parks/line-distance.js', 'src/domain/parks/osm-rings.js', 'src/domain/parks/rect-intersection.js', 'src/domain/parks/cell-in-park.js', 'src/domain/parks/park-overlap.js', 'src/services/park-geometry.js',
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
const renderLimitationsPresentation = createReportLimitationsPresentation({
    trNum, QA_LIMITS,
    YASAL_STATU_KAPSAM,
});
const renderProvenancePresentation = createReportProvenancePresentation({esc});
const renderMapPresentation = createReportMapPresentation({esc});
const renderOverviewPresentation = createReportOverviewPresentation({esc, trNum});
const renderCoverPresentation = createReportCoverPresentation({esc, trNum, QA_STATE, DGR_TITLE_DEF, FOUNDERS_LINE});
const renderStudyPresentation = createReportStudyPresentation({esc});
const renderDocumentHead = createReportDocumentHead({esc, fmtT, reportStyles, siteOrigin: SITE_ORIGIN});
const renderSourcesPresentation = createReportSourcesPresentation({esc, fmtDateTr});
const renderHistoryPresentation = createReportHistoryPresentation({esc});
const renderQaTable = createReportQaTable({esc, trNum, QA_LIMITS, DBH_REASON_TR});
const renderInventoryDetails = createReportInventoryDetails({trNum, QA_LIMITS});
const explainReportQa = createReportQaExplanation({QA_LIMITS});
const renderMethodPresentation = createReportMethodPresentation({esc, trNum, fmtDateTr});
const renderEvaluationPresentation = createReportEvaluationPresentation({esc, trNum});
const renderSpeciesPresentation = createReportSpeciesPresentation({esc, trNum});
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

  const {bars, spRows} = renderSpeciesPresentation(snap.species);

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
  const qaPresentation = createReportQaPresentation({qaStateOf, QA_STATE});
  const qaRow = qaPresentation.row;
  const {tN, DB, HD, govdeAralikTxt, hdDetail, devDetail} = renderInventoryDetails(INV);

  const qaRows = renderQaTable({qaRow, P, GQ, knotted, knotN, L, parkHa, covHa, deltaPct, dataset, dataYear, resolutionLabel, INV, nPhoto, NR, G, hdDetail, devDetail, snap, hash});

  /* Üç hâlli rapor QA durumu: Çizelge 4'ün kendisinden türetilir.
   * FINAL: saha çevresi korunur ve DBH=C/π ile türetilir; Göksu benzeri gerçek
   * saha verisi artık ⛔ BLOKLU değil 🟡 İNCELEME / 🟢 GEÇERLİ olur. */
  const {QA_ST, QA_ST_LABEL, QA_ST_CLASS, QA_BLOCKED, QA_REVIEW, qaStates} = qaPresentation.summary();
  const {AGAC_DEGER_TEMIZ, QA_WHY} = explainReportQa({INV, G, snap, nPhoto, NR});

  const evalParas = renderEvaluationPresentation({snap, L, t, ciTxt});

  const limItems = renderLimitationsPresentation({L, knotted, knotN, t, G, INV, HD, DB, govdeAralikTxt, tN});

  const histRows = renderHistoryPresentation({M, snap, id});

  const {AU, citePlain, bib, jsonld} = renderCitationPresentation({snap, P, id, hash, verTxt, doi, L, dataYear});

  const {dbhcTxt, hbRows, gnssTxt, photoTxt, lulcMethod} = renderMethodPresentation({snap, G, NR, nPhoto, L, dataset, epsg, deltaPct});

  return `<!doctype html>
<html lang="tr">
<head>
${renderDocumentHead({id, P, t, dataset, ciTxt, hash, L, jsonld})}
</head>
<body>
<div class="wrap">
${renderCoverPresentation({id, verTxt, snap, titleMain, L, QA_ST_CLASS, QA_ST_LABEL, QA_ST, subject, P, genTr, engine, engineVer, appVer, dataYear, resolutionLabel, t, parkHa, AU, qrUri, REPORT_URL, hash})}
${renderStudyPresentation(snap)}
<p class="stmt">Bu rapor, DendroGeo analiz sistemi tarafından belirlenen yöntem, veri kaynakları ve kalite kontrol prosedürleri doğrultusunda oluşturulmuştur. Rapor bir akreditasyon veya sertifikasyon belgesi değildir; bulgular, beyan edilen veri kaynakları ve çözümleme sürümü kapsamında geçerlidir.</p>

${renderOverviewPresentation({P, t, ciTxt, L, dataset, srcTxt, parkHa, GJ, knotted, knotN, snap})}
<h2><span class="no">3</span>Veri Kaynakları</h2>
${renderSourcesPresentation({L, dataset, dataYear, t})}

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
${renderMapPresentation({L, P, id, epsg})}

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

${renderProvenancePresentation({engine, engineVer, appVer, dataset, resolutionLabel, P, git, L, dataYear, id, epsg, snap, hash, doi})}
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
const publicationApplication = createReportPublicationApplication({
  artifacts:{mkdirSync, writeFileSync, renderReport, buildMetadata, mcRowCI},
  publication:{
    root:ROOT, siteOrigin:SITE_ORIGIN, gitCommit:GIT_COMMIT, engineVersion:ENGINE_VERSION, appVersion:APP_VERSION,
    reportContext, mkdirSync, nextReportId, qrDataUri, buildSnapshot, parkHistory, rebuildIndex, fmtT, citeName
  },
  cli:{
    arg, has, rebuildIndex, readFileSync, decodeReportContext,
    log:message=>console.log(message), error:message=>console.error(message), exit:code=>process.exit(code)
  }
});
export async function publishPark(parkId, opts = {}) { return publicationApplication.publishPark(parkId, opts); }
export async function main() { return publicationApplication.main(); }
if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch((e) => { console.error('❌', e.message); process.exit(1); });
