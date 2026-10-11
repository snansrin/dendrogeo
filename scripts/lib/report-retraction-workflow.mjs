import {join} from 'node:path';

/* Geri çekmenin uygulanması: veri dosyaları silinir, index.html bildirime
 * döner, liste yenilenir. root parametrik (test geçici dizinde doğrular). */
export const RETRACT_FILES = ['rapor.pdf','doi-yayin-paketi.zip','manifest.json','zenodo-metadata.json','data.json', 'olcum.csv', 'park.geojson', 'surface.geojson', 'harita.png', 'metadata.json'];
export function createReportRetractionHandler({defaultRoot, isReportId, existsSync, unlinkSync, writeFileSync, renderRetractionNotice, rebuildIndex, now = () => new Date().toISOString()}) {
return function handleRetraction(rt, pubEntry, root = defaultRoot) {
  const started = now();
  const base = {
    retraction_id: String(rt.id), report_id: String(rt.report_id), park_id: Number(rt.park_id),
    park_name: (pubEntry && pubEntry.park_name) || null,
    reason: rt.reason ? String(rt.reason).slice(0, 400) : null,
    requested_by: rt.requested_by || null, requested_at: rt.created_at || null, started_at: started,
  };
  try {
    if (!isReportId(base.report_id)) throw new Error('Geçersiz rapor kimliği: ' + base.report_id);
    const rapDir = join(root, 'rapor');
    const dir = join(rapDir, base.report_id);
    if (!dir.startsWith(rapDir) || !existsSync(dir)) throw new Error('Rapor dizini bulunamadı: ' + base.report_id);
    for (const f of RETRACT_FILES) { try { unlinkSync(join(dir, f)); } catch (e) { /* dosya zaten yok */ } }
    writeFileSync(join(dir, 'index.html'), renderRetractionNotice({
      id: base.report_id, parkName: base.park_name || '', reason: base.reason || '', retractedAt: now(),
    }));
    rebuildIndex(rapDir);
    return { ...base, status: 'Geri çekildi', finished_at: now() };
  } catch (e) {
    return { ...base, status: 'Geri çekme başarısız', message: String((e && e.message) || e).slice(0, 400), finished_at: now() };
  }
};
}
