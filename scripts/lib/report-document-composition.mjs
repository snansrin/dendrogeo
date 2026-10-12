import {renderReportDocumentClientScript} from './report-document-client-script.mjs';
import {renderReportMethodSection} from './report-method-section.mjs';
import {renderReportVerificationSection} from './report-verification-section.mjs';
import {renderReportDocumentBackmatter} from './report-document-backmatter.mjs';
import {prepareReportDocumentQuality} from './report-document-quality-preparation.mjs';
import {prepareReportDocumentContext} from './report-document-context.mjs';
/* Report HTML composition. The injected presentation functions keep this layer
 * independent from data access, snapshot calculation, and publication I/O. */
export function createReportDocumentRenderer(dependencies) {
  const { fmtT, fmtDateTr, esc, trNum, epsgLabel, SITE_ORIGIN, DGR_TITLE_DEF, renderSpeciesPresentation, createReportQaPresentation, qaStateOf, QA_STATE, renderInventoryDetails, renderQaTable, explainReportQa, renderEvaluationPresentation, renderLimitationsPresentation, renderHistoryPresentation, renderCitationPresentation, renderMethodPresentation, renderDocumentHead, renderCoverPresentation, renderStudyPresentation, renderOverviewPresentation, renderSourcesPresentation, REPORT_DATA_DICTIONARY, renderResultsPresentation, renderMapPresentation, renderProvenancePresentation, renderReferencesPresentation, renderReportDataAccess, REPORT_SHARE_SCRIPT } = dependencies;
  return function renderReport(snap, { id, hash, version = 1, meta = null }) {
  const {t, P, M, doi, verTxt, L, GQ, GJ, srcTxt, INV, G, knotN, knotted, ciTxt, engine, engineVer, appVer, git, resolutionLabel, dataset, dataYear, epsg, genTr, REPORT_URL, qrUri, subject, titleMain} = prepareReportDocumentContext({
    snap, id, hash, version, meta, dependencies: {fmtT, fmtDateTr, esc, epsgLabel, SITE_ORIGIN}
  });

  const {bars, spRows} = renderSpeciesPresentation(snap.species);

    const {NR, nPhoto, parkHa, covHa, clsHa, diffHa, deltaPct, tN, DB, HD, govdeAralikTxt, hdDetail, devDetail, qaRows, QA_ST, QA_ST_LABEL, QA_ST_CLASS, QA_BLOCKED, QA_REVIEW, qaStates, AGAC_DEGER_TEMIZ, QA_WHY} = prepareReportDocumentQuality({
    snap, t, P, L, GQ, knotted, knotN, dataset, dataYear, resolutionLabel, INV, G, hash,
    createReportQaPresentation, qaStateOf, QA_STATE, renderInventoryDetails, renderQaTable, explainReportQa
  });

  const evalParas = renderEvaluationPresentation({snap, L, t, ciTxt});

  const limItems = renderLimitationsPresentation({L, knotted, knotN, t, G, INV, HD, DB, govdeAralikTxt, tN});

  const histRows = renderHistoryPresentation({M, snap, id});

  const {AU, citePlain, bib, jsonld} = renderCitationPresentation({snap, P, id, hash, verTxt, doi, L, dataYear});

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

${renderReportMethodSection({snap, G, NR, nPhoto, L, dataset, epsg, deltaPct, parkHa, GJ, knotted, knotN, renderMethodPresentation, REPORT_DATA_DICTIONARY, esc, trNum})}
<h2><span class="no">5</span>Nicel Sonuçlar</h2>
${renderResultsPresentation({spRows, bars, ciTxt, snap, govdeAralikTxt, L, parkHa, covHa, clsHa, diffHa, deltaPct})}
<h2><span class="no">6</span>Harita</h2>
${renderMapPresentation({L, P, id, epsg})}

${renderReportVerificationSection({QA_ST_LABEL, QA_BLOCKED, QA_WHY, QA_REVIEW, AGAC_DEGER_TEMIZ, qaStates, qaRows, id, verTxt, hash, snap})}

<h2><span class="no">8</span>Değerlendirme</h2>
${evalParas}

<h2><span class="no">9</span>Sınırlılıklar</h2>
<ul class="lim">
 ${limItems}
</ul>

${renderReportDocumentBackmatter({renderProvenancePresentation, provenance: {engine, engineVer, appVer, dataset, resolutionLabel, P, git, L, dataYear, id, epsg, snap, hash, doi}, histRows, citePlain, bib, L, renderReferencesPresentation, renderReportDataAccess, M, DGR_TITLE_DEF, esc})}
</div>
<script>${renderReportDocumentClientScript({hash, snapshot: snap, shareScript: REPORT_SHARE_SCRIPT})}</script>
</body>
</html>`;
};
}
