import {renderReportDocumentClientScript} from './report-document-client-script.mjs';
import {renderReportMethodSection} from './report-method-section.mjs';
import {renderReportVerificationSection} from './report-verification-section.mjs';
import {renderReportDocumentBackmatter} from './report-document-backmatter.mjs';
import {prepareReportDocumentQuality} from './report-document-quality-preparation.mjs';
/* Report HTML composition. The injected presentation functions keep this layer
 * independent from data access, snapshot calculation, and publication I/O. */
export function createReportDocumentRenderer(dependencies) {
  const { fmtT, fmtDateTr, esc, trNum, epsgLabel, SITE_ORIGIN, DGR_TITLE_DEF, renderSpeciesPresentation, createReportQaPresentation, qaStateOf, QA_STATE, renderInventoryDetails, renderQaTable, explainReportQa, renderEvaluationPresentation, renderLimitationsPresentation, renderHistoryPresentation, renderCitationPresentation, renderMethodPresentation, renderDocumentHead, renderCoverPresentation, renderStudyPresentation, renderOverviewPresentation, renderSourcesPresentation, REPORT_DATA_DICTIONARY, renderResultsPresentation, renderMapPresentation, renderProvenancePresentation, renderReferencesPresentation, renderReportDataAccess, REPORT_SHARE_SCRIPT } = dependencies;
  return function renderReport(snap, { id, hash, version = 1, meta = null }) {
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
