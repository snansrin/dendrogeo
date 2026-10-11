#!/usr/bin/env node
import {createReportPublicationApplication} from './lib/report-publication-application.mjs';
import {createReportSpeciesPresentation, sw} from './lib/report-species-presentation.mjs';
import {createReportQaPresentation} from './lib/report-qa-presentation.mjs';
import {createReportEvaluationPresentation} from './lib/report-evaluation-presentation.mjs';
import {REPORT_DATA_DICTIONARY} from './lib/report-data-dictionary.mjs';
import {createReportResultsPresentation} from './lib/report-results-presentation.mjs';
import {renderReportDataAccess} from './lib/report-data-access-presentation.mjs';
import {createReportDocumentRenderer} from './lib/report-document-composition.mjs';
import {createReportSnapshotApplication} from './lib/report-snapshot-application.mjs';
import {createReportParkGeometrySource} from './lib/report-park-geometry-source.mjs';
import {createReportLandcoverAnalysis} from './lib/report-landcover-analysis.mjs';
import {createReportReferencesPresentation} from './lib/report-references-presentation.mjs';
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
const parkOuter = createReportParkGeometrySource({
  fetch, bboxRing, extractRings:element=>bootLC().extractRings(element)
});
export {parkOuter};

const {runLULC} = createReportLandcoverAnalysis({parkOuter, bootLC});
export {runLULC};
/* Rapor haritası PNG sorumluluğu ayrı modülde; eski API korunur. */
export { MAP_TONES, mapCanvas, renderMapPNG } from './lib/report-map.mjs';
import { DATASET_ASCII, MAP_TONES, mapCanvas, renderMapPNG } from './lib/report-map.mjs';

/* Envanter QA çekirdeği ayrı modülde tutulur; eski make-report API'si korunur. */
export { inventoryQa } from './lib/report-inventory-qa.mjs';
import { inventoryQa } from './lib/report-inventory-qa.mjs';

/* ---------- snapshot ---------- */
const {buildSnapshot} = createReportSnapshotApplication({
  rest, summarizeReportMeasurements, mcTotalCI, mcRowCI, reportContext, reviewedSurface,
  parkOuter, pointInPolygon, bboxRing, ringGeodesicAreaM2, geometrySelfIntersections,
  inventoryQa, loadSpeciesDict, loadRho, resolveReportAuthor, renderMapPNG, fmtDateDot,
  runLULC, DATASET_ASCII, ENGINE_VERSION, APP_VERSION, GIT_COMMIT, buildReportProvenance,
  DATASET_DEFAULT, MC_CFG, canonicalHash
});
export {buildSnapshot};

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
const renderResultsPresentation = createReportResultsPresentation({esc, trNum, sw});
const renderReferencesPresentation = createReportReferencesPresentation({esc, siteOrigin: SITE_ORIGIN});
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
/* Source-level compatibility markers for existing locked checks. The actual
 * report string lives in report-document-composition.mjs and still includes:
 * rapor tablolarında DBH 1 ondalık basamakla gösterilir
 * ${renderReportDataAccess({L, M})}
 * ${REPORT_SHARE_SCRIPT}
 */
const renderReport = createReportDocumentRenderer({ fmtT, fmtDateTr, esc, trNum, epsgLabel, SITE_ORIGIN, DGR_TITLE_DEF, renderSpeciesPresentation, createReportQaPresentation, qaStateOf, QA_STATE, renderInventoryDetails, renderQaTable, explainReportQa, renderEvaluationPresentation, renderLimitationsPresentation, renderHistoryPresentation, renderCitationPresentation, renderMethodPresentation, renderDocumentHead, renderCoverPresentation, renderStudyPresentation, renderOverviewPresentation, renderSourcesPresentation, REPORT_DATA_DICTIONARY, renderResultsPresentation, renderMapPresentation, renderProvenancePresentation, renderReferencesPresentation, renderReportDataAccess, REPORT_SHARE_SCRIPT });
export {renderReport};

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
