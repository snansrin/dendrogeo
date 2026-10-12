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
  /* QA durumu tablodan türetilir; satırlar ve rozet aynı sunum kaynağını kullanır. */
  const qaPresentation = createReportQaPresentation({qaStateOf, QA_STATE});
  const qaRow = qaPresentation.row;
  const {tN, DB, HD, govdeAralikTxt, hdDetail, devDetail} = renderInventoryDetails(INV);
  const qaRows = renderQaTable({qaRow, P, GQ, knotted, knotN, L, parkHa, covHa, deltaPct, dataset, dataYear, resolutionLabel, INV, nPhoto, NR, G, hdDetail, devDetail, snap, hash});
  const {QA_ST, QA_ST_LABEL, QA_ST_CLASS, QA_BLOCKED, QA_REVIEW, qaStates} = qaPresentation.summary();
  const {AGAC_DEGER_TEMIZ, QA_WHY} = explainReportQa({INV, G, snap, nPhoto, NR});
  return {NR, nPhoto, parkHa, covHa, clsHa, diffHa, deltaPct, tN, DB, HD, govdeAralikTxt, hdDetail, devDetail, qaRows, QA_ST, QA_ST_LABEL, QA_ST_CLASS, QA_BLOCKED, QA_REVIEW, qaStates, AGAC_DEGER_TEMIZ, QA_WHY};
}
