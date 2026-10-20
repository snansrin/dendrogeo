import {isAcceptedSurfaceSnapshot} from './surface-snapshot.mjs';

export function createReportQueueRunner({RUN_LIMIT, QUEUE_PATH, loadQueue, saveQueue, effectiveProcessedRequestIds, fetchPending, fetchPendingRetractions, planQueue, planRetractions, handle, handleRetraction, log}) {
/* ---------- ana akış ---------- */
return async function runQueue(opts = {}) {
  const limit = Number(opts.limit || RUN_LIMIT);
  const dry = opts.dry;
  const q = loadQueue();
  let requests = [];
  try {
    const effectiveProcessed=effectiveProcessedRequestIds(q.entries,q.processed_request_ids||[]);
    requests = await fetchPending(50,effectiveProcessed,q.production_started_at||null);
  } catch (e) {
    log('⚠ Kuyruk okunamadı: ' + e.message);
    return { ok: false, processed: 0, entries: q.entries, reason: e.code || 'FETCH' };
  }
  const plan = planQueue(q.entries, requests, limit, q.processed_request_ids || []);
  log(`📄 Yayın kuyruğu: ${requests.length} bekleyen istek · ${plan.already} zaten işlenmiş · ${plan.todo.length} bu koşuda üretilecek${plan.skipped ? ` · ${plan.skipped} sonraki koşuya kaldı` : ''}`);

  let retractions = [], retMissing = false;
  try {
    const rr = await fetchPendingRetractions(50,q.processed_retraction_ids||[],q.production_started_at||null);
    retractions = rr.rows; retMissing = rr.missing;
  } catch (e) {
    log('⚠ Geri çekme kuyruğu okunamadı: ' + e.message);
  }
  const rplan = planRetractions(q.entries, retractions.filter(r=>!(q.processed_retraction_ids||[]).includes(String(r.id))), limit);
  if (!retMissing && (retractions.length || rplan.todo.length))
    log(`🗑 Geri çekme kuyruğu: ${retractions.length} bekleyen · ${rplan.todo.length} bu koşuda işlenecek${rplan.invalid.length ? ` · ${rplan.invalid.length} geçersiz/eşleşmeyen (İŞLENMEDİ)` : ''}`);

  if (!plan.todo.length && !rplan.todo.length) { log('✅ Üretilecek rapor yok, işlenecek geri çekme yok.'); return { ok: true, processed: 0, entries: q.entries }; }
  if (dry) {
    for (const r of plan.todo) {
      const mode=isAcceptedSurfaceSnapshot(r.surface_snapshot)?'son kabul edilmiş yüzey snapshotı':(r.with_lulc===false?'LULC atlanacak':'LULC dahil');
      log(`   · (prova) park #${r.park_id} · istek ${r.id} · ${mode}`);
    }
    for (const r of rplan.todo) log(`   · (prova) geri çekme ${r.id} · ${r.report_id}`);
    return { ok: true, processed: 0, dry: true, entries: q.entries };
  }
  let ok = 0, fail = 0;
  for (const r of plan.todo) {
    const mode=isAcceptedSurfaceSnapshot(r.surface_snapshot)?'kabul edilmiş yüzey snapshotı':(r.with_lulc===false?'LULC atlandı':'LULC dahil');
    log(`\n▶ park #${r.park_id} (istek ${r.id}) · ${mode}`);
    const entry = await handle(r);
    q.entries.push(entry);
    if (entry.status === 'Yayınlandı') {
      ok++;
      log(`  ✅ ${entry.report_id} · n=${entry.n} · ${entry.carbon_txt}`);
      log(`     ${entry.url_path} · ${entry.report_hash.slice(0, 27)}…${entry.archive_bytes ? ' · arşiv ' + (entry.archive_bytes / 1024).toFixed(0) + ' KB' : ''}`);
    } else {
      fail++;
      log(`  ❌ üretilemedi: ${entry.message}`);
    }
    saveQueue(q);
  }

  let retOk = 0, retFail = 0;
  for (const rt of rplan.todo) {
    log(`\n🗑 geri çekme ${rt.id} · ${rt.report_id}`);
    const pubEntry = q.entries.find((e) => e.status === 'Yayınlandı' && String(e.report_id) === String(rt.report_id)) || null;
    // The queue and report pages are public GitHub Pages artifacts. Keep the
    // database reason private by opting into the public-safe notice path.
    const entry = handleRetraction({...rt, reason: '', public_safe: true}, pubEntry);
    q.entries.push(entry);
    if (entry.status === 'Geri çekildi') { retOk++; log(`  ✅ ${entry.report_id} yayından kaldırıldı (bildirim yerinde, listeden düştü)`); }
    else { retFail++; log(`  ❌ geri çekilemedi: ${entry.message}`); }
    saveQueue(q);
  }

  log(`\n📦 Kuyruk sonucu: ${ok} yayınlandı, ${fail} başarısız, ${retOk} geri çekildi, ${retFail} geri çekme başarısız → ${QUEUE_PATH}`);
  return { ok: fail === 0 && retFail === 0, processed: ok + fail + retOk + retFail, published: ok, failed: fail, retracted: retOk, retractFailed: retFail, entries: q.entries };
};
}
