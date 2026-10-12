import {renderReportDocumentClientScript} from './report-document-client-script.mjs';
import {renderReportMethodSection} from './report-method-section.mjs';
import {renderReportVerificationSection} from './report-verification-section.mjs';
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

${renderProvenancePresentation({engine, engineVer, appVer, dataset, resolutionLabel, P, git, L, dataYear, id, epsg, snap, hash, doi})}
<h2><span class="no">12</span>Rapor Geçmişi</h2>
<div class="tscroll"><table><thead><tr><th>Rapor</th><th>Sürüm</th><th>Tarih</th><th>İşlem</th></tr></thead><tbody>${histRows}</tbody></table></div>
<p class="qnote">Bu çizelge aynı parkın üretim yayınlarını gösterir. Test yayınları sürüm zincirine dahil edilmemiştir. Veri veya yöntem değişiklikleri yeni rapor kimliği ve sürüm kaydıyla yayımlanır.</p>

<h2><span class="no">13</span>Atıf</h2>
<div class="cite"><b>Önerilen atıf</b><br>${esc(citePlain)}
<div class="sans" style="margin-top:8px;color:var(--mut)">Yöntem kaynakları: Chave ve ark. (2014) <code>10.1111/gcb.12629</code>${L ? ` · ${esc(L.citation)}` : ''} · OpenStreetMap katkıcıları (ODbL).</div></div>
<pre>${esc(bib)}</pre>

<h2><span class="no">14</span>Kaynakça</h2>
${renderReferencesPresentation(L)}

<h2><span class="no">Ek</span>A — Veri Erişilebilirliği</h2>
${renderReportDataAccess({L, M})}
<div class="foot">DendroGeo · Küresel Ağaç Envanteri ve Karbon Veri Sistemi · ${DGR_TITLE_DEF} · Bu sayfa yayın anında dondurulmuştur; sonraki çözümlemeler yeni DGR kimliği alır, geri çekmeler günlüğe işlenir. CC BY-NC 4.0 · © DendroGeo</div>
</div>
<script>${renderReportDocumentClientScript({hash, snapshot: snap, shareScript: REPORT_SHARE_SCRIPT})}</script>
</body>
</html>`;
};
}
