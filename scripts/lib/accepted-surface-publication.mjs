import {join} from 'node:path';
import {canonicalHash} from './canonical-hash.mjs';
import {acceptedSurfaceToLulc, stripUnavailableSurfaceMap, isAcceptedSurfaceSnapshot} from './surface-snapshot.mjs';

export function createAcceptedSurfacePublisher({defaultRoot, readFileSync, writeFileSync, existsSync, unlinkSync, renderReport, buildMetadata, qrDataUri, parkHistory, rebuildIndex}) {
/* Kabul edilmiş yüzey sonucu, publishPark'in ürettiği normal snapshot üzerine
 * rapor kimliği değişmeden yeniden dondurulur. Bu aşama geometri açığa çıkarmaz. */
return async function applyAcceptedSurfaceSnapshot(pub, surfaceSnapshot, root = defaultRoot) {
  if (!isAcceptedSurfaceSnapshot(surfaceSnapshot)) return pub;
  const dir = join(root, 'rapor', String(pub.id));
  const dataPath = join(dir, 'data.json');
  if (!existsSync(dataPath)) throw new Error('Yayın snapshot dosyası bulunamadı: ' + pub.id);
  const snap = JSON.parse(readFileSync(dataPath, 'utf8'));
  const lulc = acceptedSurfaceToLulc(surfaceSnapshot, snap.park && snap.park.area_m2);
  if (!lulc) throw new Error('Kabul edilmiş yüzey snapshot alanları geçersiz veya boş.');

  snap.lulc = lulc;
  snap.provenance = {
    ...(snap.provenance || {}),
    dataset: lulc.source,
    epsg: null,
    surface_review: {
      schema: surfaceSnapshot.schema,
      revision: lulc.revision,
      accepted_at: lulc.accepted_at,
      source_fingerprint: lulc.source_fingerprint,
      object_fingerprint: lulc.object_fingerprint,
      geometry_published: false,
    },
  };
  const hash = canonicalHash(snap);
  const rapDir = join(root, 'rapor');
  const history = parkHistory(rapDir, snap.park.id, pub.id);
  const meta = {
    id: pub.id,
    git_commit: snap.provenance.git_commit || null,
    engine_version: snap.provenance.engine_version || null,
    app_version: snap.provenance.app_version || null,
    qr_uri: await qrDataUri(pub.url),
  };
  let html = renderReport(snap, { id: pub.id, hash, version: pub.version || 1, meta: { ...meta, history } });
  html = stripUnavailableSurfaceMap(html);
  writeFileSync(join(dir, 'index.html'), html);
  writeFileSync(dataPath, JSON.stringify(snap));
  writeFileSync(join(dir, 'metadata.json'), JSON.stringify(buildMetadata(snap, { id: pub.id, hash, version: '1.0', meta, history })) + '\n');
  try { unlinkSync(join(dir, 'harita.png')); } catch (e) { /* kabul snapshot'ında geometri yayımlanmaz */ }
  rebuildIndex(rapDir);
  return {
    ...pub,
    hash,
    lulc: `dahil (son kabul edilmiş yüzey kaydı · r${lulc.revision || '—'})`,
    surface_snapshot: true,
    surface_revision: lulc.revision,
    surface_accepted_at: lulc.accepted_at,
  };
};
}
