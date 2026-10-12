#!/usr/bin/env node
import {createReportPublicationApplication} from './lib/report-publication-application.mjs';
import {createReportRepositoryAccess} from './lib/report-repository-access.mjs';
import {resolveReportSiteOrigin} from './lib/report-site-origin.mjs';
import {createReportCliArguments} from './lib/report-cli-arguments.mjs';
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
import {createReportRestAdapter} from './lib/report-rest-adapter.mjs';
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
import { fileURLToPath } from 'node:url';
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
import { citeName, fmtDateTr, fmtDateDot, epsgLabel, formatReportNumber as trNum, formatReportTonnesFromKg as fmtT } from './lib/report-formatting.mjs';
import {escapeReportHtml} from './lib/report-html-escaping.mjs';
export { citeName, fmtDateTr, fmtDateDot, epsgLabel };
import { createRetractionNotice } from './lib/report-retraction.mjs';
import { createQrDataUri } from './lib/report-qr.mjs';
import { resolveReportAuthor } from './lib/report-author.mjs';
import { REPORT_SHARE_SCRIPT } from './lib/report-share.mjs';
import { reportStyles } from './lib/report-style.mjs';
import { summarizeReportMeasurements } from './lib/report-measurement-summary.mjs';
import { createRequire } from 'node:module';
const require_ = createRequire(import.meta.url);
/* qrcode (MIT) YALNIZ build bağımlılığıdır. Kurulu değilse (örn. npm install
 * çalıştırılmamış ortam) rapor üretimi ÇÖKMEZ: QR hücresi atlanır, kalıcı
 * adres künyede metin olarak kalır. QR kozmetiktir; kimlik/hash ondan
 * bağımsızdır. */
let QRlib = null;
try { QRlib = require_('qrcode'); } catch (e) { QRlib = null; }
export const qrDataUri = createQrDataUri(QRlib);

const {root:ROOT, read} = createReportRepositoryAccess(import.meta.url);
/* Yayın kökü: CNAME'den türetilir (elle yazılmış sabit URL sürüklenmesin). */
const SITE_ORIGIN = resolveReportSiteOrigin(read);
const renderCitationPresentation = createReportCitationPresentation({citeName, siteOrigin: SITE_ORIGIN});
const {arg, has} = createReportCliArguments(process.argv);

/* Rapor parmak izi sabitleri (2026-09-28 · kullanıcı standardı): motor sürümü
 * lc-config'den (tek doğruluk kaynağı), uygulama sürümü package.json'dan,
 * git commit üretim anındaki depodan okunur. Değer yoksa null → rapor '—'
 * basar; ASLA uydurulmaz. */
const {engineVersion:ENGINE_VERSION, appVersion:APP_VERSION, gitCommit:GIT_COMMIT} = readReportRuntimeProvenance({
  read, readGitCommit:()=>execSync('git rev-parse HEAD', {cwd:ROOT, encoding:'utf8', stdio:['ignore','pipe','ignore']})
});
const DATASET_DEFAULT = 'ESA WorldCover 10 m · 2021 (v200)';

const {rest} = createReportRestAdapter({read, reportRead});
const esc = escapeReportHtml;

export {createReportLandcoverRuntime} from './lib/report-landcover-runtime.mjs';
import {createReportLandcoverRuntime} from './lib/report-landcover-runtime.mjs';
const bootLC = createReportLandcoverRuntime({read});
export {bootLC};
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
