import {join} from 'node:path';

export function createParkReportPublisher({root:ROOT, siteOrigin:SITE_ORIGIN, gitCommit:GIT_COMMIT, engineVersion:ENGINE_VERSION, appVersion:APP_VERSION, reportContext, mkdirSync, nextReportId, qrDataUri, buildSnapshot, parkHistory, writeReportArtifacts, rebuildIndex, fmtT, citeName, currentYear=()=>new Date().getFullYear()}) {
return async function publishPark(parkId, opts = {}) {
  const validation=reportContext.validate(opts.study);if(!validation.valid)throw Error('Yayın künyesi gerekli: '+Object.values(validation.errors).join(' '));opts={...opts,study:validation.value};
  const year = currentYear();
  const dir = join(ROOT, 'rapor');
  mkdirSync(dir, { recursive: true });
  /* Kimlik ÖNCE atanır: snapshot, PNG altbilgisi ve parmak izi aynı DGR'yi
   * taşısın diye meta olarak buildSnapshot'e iner. */
  const id = nextReportId(dir, year);
  const meta = { id, git_commit: GIT_COMMIT, engine_version: ENGINE_VERSION, app_version: APP_VERSION, ...(opts.study ? {study:opts.study} : {}) };
  meta.qr_uri = await qrDataUri(SITE_ORIGIN + '/rapor/' + id + '/'); /* künye QR'ı (0012) */
  const { snap, hash, png } = await buildSnapshot(+parkId, { skipLulc: !!opts.skipLulc, meta, surfaceSnapshot: opts.surfaceSnapshot || null });
  const version = 1;          /* iç sürüm alanı (sayı) — kuyruk günlüğü bunu taşır */
  const verTxt = '1.0';       /* belge sürümü (gösterim/metadata): her DGR 1.0 doğar */
  const history = parkHistory(dir, snap.park.id, id);
  writeReportArtifacts({dir, id, snap, hash, png, version, verTxt, meta, history});
  rebuildIndex();
  const url = SITE_ORIGIN + '/rapor/' + id + '/';
  return {
    id, version, url, path: 'rapor/' + id + '/', hash,
    park_id: snap.park.id, park_name: snap.park.name, city: snap.park.city,
    n: snap.totals.n, carbon_kg: snap.totals.carbon_kg, per_ha_kg: snap.totals.per_ha_kg,
    ci: snap.totals.ci,
    carbon_txt: `${fmtT(snap.totals.ci.mean)} t [%95 GA ${fmtT(snap.totals.ci.lo)}–${fmtT(snap.totals.ci.hi)}]`,
    lulc: snap.lulc ? (snap.lulc.error ? 'hata: ' + snap.lulc.error : 'dahil (' + snap.lulc.source + ')') : 'atlandı',
    generated_at: snap.generated_at,
    report_version: verTxt,
    metadata_path: 'rapor/' + id + '/metadata.json',
    supersedes: history.filter((h) => !h.retracted).map((h) => h.id),
    citation: `${(snap.author && snap.author.name) ? citeName(snap.author.name) : 'DendroGeo'} (${snap.generated_at.slice(0, 4)}). ${snap.park.name} ağaç envanteri ve karbon stoku raporu (${id}, sürüm ${verTxt}). DendroGeo Bilimsel Analiz Raporu. ${url}`,
  };
};
}
