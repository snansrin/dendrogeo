import {isAcceptedSurfaceSnapshot} from './surface-snapshot.mjs';

export function createPublicationRequestHandler({publishPark, publicationOptions, applyAcceptedSurfaceSnapshot, measureArchive, now = () => new Date().toISOString()}) {
/* ---------- tek isteğin işlenmesi ---------- */
return async function handle(req) {
  const started = now();
  const accepted = isAcceptedSurfaceSnapshot(req.surface_snapshot);
  const geometrySnapshot = req.surface_snapshot?.schema === "dendrogeo-surface/2";
  const base = {
    request_id: String(req.id), park_id: Number(req.park_id),
    with_lulc: req.with_lulc !== false,
    surface_snapshot: accepted || geometrySnapshot,
    requested_at: req.created_at || null, started_at: started,
  };
  try {
    /* Kabul edilmiş snapshot varsa yeniden LULC çalıştırma: önce hızlı temel
     * rapor iskeleti üretilir, sonra kabul edilmiş alanlar aynı DGR'ye bağlanır. */
    if(req.surface_snapshot && !accepted && !geometrySnapshot)throw new Error("Bilinmeyen kayıtlı analiz şeması");
    let r = await publishPark(req.park_id, publicationOptions(req, {accepted, geometrySnapshot}));
    if (accepted) r = await applyAcceptedSurfaceSnapshot(r, req.surface_snapshot);
    let bytes = null;
    try {
      bytes = await measureArchive(r.id);
    } catch (e) { /* boyut ölçümü yayın engeli değil */ }
    return {
      ...base,
      status: 'Yayınlandı',
      archive_bytes: bytes,
      report_id: r.id, version: r.version,
      url_path: '/rapor/' + r.id + '/',
      report_hash: 'sha256:' + r.hash,
      park_name: r.park_name, city: r.city, n: r.n,
      carbon_txt: r.carbon_txt, lulc: r.lulc, citation: r.citation,
      surface_revision: r.surface_revision || null,
      surface_accepted_at: r.surface_accepted_at || null,
      finished_at: now(),
    };
  } catch (e) {
    return {
      ...base,
      status: 'Başarısız',
      message: String((e && e.message) || e).slice(0, 400),
      finished_at: now(),
    };
  }
};
}
