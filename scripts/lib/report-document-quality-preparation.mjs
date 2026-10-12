/* Prepare the existing document QA summary and table from snapshot data.
 * QA policy and individual control rendering stay with their injected modules. */
export function prepareReportDocumentQuality({snap, t, P, L, GQ, knotted, knotN, dataset, dataYear, resolutionLabel, INV, G, hash, createReportQaPresentation, qaStateOf, QA_STATE, renderInventoryDetails, renderQaTable, explainReportQa}) {
  /* QA/QC sayıları (gerçek değerler; uydurma yok). */
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
  /* Üç hâlli rapor QA durumu Çizelge 4'ün kendisinden türetilir.
   * DBH kuralları, bloklama ve inceleme eşikleri QA domain modülünde kalır. */
  const {QA_ST, QA_ST_LABEL, QA_ST_CLASS, QA_BLOCKED, QA_REVIEW, qaStates} = qaPresentation.summary();
  const {AGAC_DEGER_TEMIZ, QA_WHY} = explainReportQa({INV, G, snap, nPhoto, NR});
  return {NR, nPhoto, parkHa, covHa, clsHa, diffHa, deltaPct, tN, DB, HD, govdeAralikTxt, hdDetail, devDetail, qaRows, QA_ST, QA_ST_LABEL, QA_ST_CLASS, QA_BLOCKED, QA_REVIEW, qaStates, AGAC_DEGER_TEMIZ, QA_WHY};
}
