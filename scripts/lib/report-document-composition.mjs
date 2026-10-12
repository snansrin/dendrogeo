import {renderReportDocumentClientScript} from './report-document-client-script.mjs';
import {renderReportMethodSection} from './report-method-section.mjs';
import {renderReportVerificationSection} from './report-verification-section.mjs';
import {renderReportDocumentBackmatter} from './report-document-backmatter.mjs';
import {prepareReportDocumentQuality} from './report-document-quality-preparation.mjs';
import {prepareReportDocumentContext} from './report-document-context.mjs';
import {renderReportDiscussionSections} from './report-discussion-sections.mjs';
import {renderReportDocumentOpening} from './report-document-opening.mjs';
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

  const discussionSections = renderReportDiscussionSections({
    snap, L, t, ciTxt, knotted, knotN, G, INV, HD, DB, govdeAralikTxt, tN,
    renderEvaluationPresentation, renderLimitationsPresentation
  });

  const histRows = renderHistoryPresentation({M, snap, id});

  const {AU, citePlain, bib, jsonld} = renderCitationPresentation({snap, P, id, hash, verTxt, doi, L, dataYear});

  return `<!doctype html>
<html lang="tr">
<head>
${renderDocumentHead({id, P, t, dataset, ciTxt, hash, L, jsonld})}
</head>
<body>
<div class="wrap">
${renderReportDocumentOpening({
  renderCoverPresentation, cover: {id, verTxt, snap, titleMain, L, QA_ST_CLASS, QA_ST_LABEL, QA_ST, subject, P, genTr, engine, engineVer, appVer, dataYear, resolutionLabel, t, parkHa, AU, qrUri, REPORT_URL, hash},
  renderStudyPresentation, study: snap,
  renderOverviewPresentation, overview: {P, t, ciTxt, L, dataset, srcTxt, parkHa, GJ, knotted, knotN, snap},
  renderSourcesPresentation, sources: {L, dataset, dataYear, t}
})}

${renderReportMethodSection({snap, G, NR, nPhoto, L, dataset, epsg, deltaPct, parkHa, GJ, knotted, knotN, renderMethodPresentation, REPORT_DATA_DICTIONARY, esc, trNum})}
<h2><span class="no">5</span>Nicel Sonuçlar</h2>
${renderResultsPresentation({spRows, bars, ciTxt, snap, govdeAralikTxt, L, parkHa, covHa, clsHa, diffHa, deltaPct})}
<h2><span class="no">6</span>Harita</h2>
${renderMapPresentation({L, P, id, epsg})}

${renderReportVerificationSection({QA_ST_LABEL, QA_BLOCKED, QA_WHY, QA_REVIEW, AGAC_DEGER_TEMIZ, qaStates, qaRows, id, verTxt, hash, snap})}

${discussionSections}

${renderReportDocumentBackmatter({renderProvenancePresentation, provenance: {engine, engineVer, appVer, dataset, resolutionLabel, P, git, L, dataYear, id, epsg, snap, hash, doi}, histRows, citePlain, bib, L, renderReferencesPresentation, renderReportDataAccess, M, DGR_TITLE_DEF, esc})}
</div>
<script>${renderReportDocumentClientScript({hash, snapshot: snap, shareScript: REPORT_SHARE_SCRIPT})}</script>
</body>
</html>`;
};
}
