/* Prepare the immutable report's existing HTML presentation context.
 * Snapshot fields, disclosure text, versioning and fallback choices are preserved. */
export function prepareReportDocumentContext({snap, id, hash, version, meta, dependencies}) {
  const {fmtT, fmtDateTr, esc, epsgLabel, SITE_ORIGIN} = dependencies;
  const t = snap.totals, P = snap.park;
  const M = Object.assign({}, snap.provenance || {}, meta || {});
  const doi = /^10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+$/.test(String(M.doi || '')) ? String(M.doi) : null;
  const verTxt = String(version).includes('.') ? String(version) : version + '.0';
  const L = (snap.lulc && !snap.lulc.error) ? snap.lulc : null;
  const GQ = snap.geometry_qa || null;
  const GJ = (GQ && GQ.geom_json_bbox_ignored) || null;
  /* §2 boundary-source label preserves the existing distinction between an
   * accepted application polygon and an OpenStreetMap geometry. */
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
  /* QR is precomputed during publication; no page-load network request is made. */
  const REPORT_URL = SITE_ORIGIN + '/rapor/' + id + '/';
  const qrUri = (M && M.qr_uri) || null;
  const subject = `${P.name} Ağaç Envanteri, Karbon Stoku ve Arazi Örtüsü Analizi`;
  const titleMain = `${esc(P.name)} (${esc(P.city)}): Bireysel Ağaç Envanteri ve Toprak Üstü / Toprak Altı Karbon Stoku`;
  return {t, P, M, doi, verTxt, L, GQ, GJ, srcTxt, INV, G, knotN, knotted, ciTxt, engine, engineVer, appVer, git, resolutionLabel, dataset, dataYear, epsg, genTr, REPORT_URL, qrUri, subject, titleMain};
}
