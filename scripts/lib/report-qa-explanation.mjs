/* Explain existing QA findings without classifying or modifying measurements. */
export function createReportQaExplanation({QA_LIMITS}) {
  return function explainQa({INV, G, snap, nPhoto, NR}) {
  /* 0032 · İnceleme kalemleri ağaç DEĞERLERİYLE ilgili mi? Değilse rapor bunu
   * açıkça söyler: kullanıcı, kendi ölçümünün şüpheli olduğu izlenimini
   * görmemeli. Örnek: GNSS accuracy_m alanı boşsa kontrol KOŞULAMAZ (⚠) ama
   * DBH/boy/karbon kontrollerinin tümü geçerlidir. */
  const AGAC_DEGER_TEMIZ = !INV || (!INV.dbh_fail.length && !INV.hd_fail.length && !INV.h_fail.length && !INV.dev_fail.length && !INV.n_unknown);
  /* İnceleme/blok kalemlerinin adı — §7 giriş cümlesinde sayıyla beyan edilir. */
  const qaWhy = [];
  if (INV) {
    if (INV.dbh_fail.length) qaWhy.push(`DBH geçerlilik kontrolünde ${INV.dbh_fail.length}/${INV.n} kayıt`);
    if (INV.hd_review) qaWhy.push(`gövde formu (boy/çap) incelemesinde ${INV.hd_fail.length}/${INV.n} kayıt fiziksel makullük bandı dışında veya stand içi aykırı`);
    if (INV.dev_fail.length) qaWhy.push(`karbon yeniden hesabında ${INV.dev_fail.length}/${INV.n} kayıt ±%${QA_LIMITS.CARBON_DEV_PCT} bandı dışında`);
    if (INV.species_review) qaWhy.push(`${INV.n_unknown} tür kanonik sözlük dışında`);
  }
  if ((G.n_with_acc ?? 0) === 0) qaWhy.push('GNSS alıcı doğruluğu (accuracy_m) kaydedilmemiş');
  if ((snap.geofence.outside_rows || 0) > 0) qaWhy.push(`${snap.geofence.outside_rows} kayıt poligon dışında`);
  if (nPhoto < NR) qaWhy.push(`${NR - nPhoto} kayıtta fotoğraf kanıtı eksik`);
  const QA_WHY = qaWhy.join('; ');

    return {AGAC_DEGER_TEMIZ, QA_WHY};
  };
}
