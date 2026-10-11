/* Compose report QA rows using the report-local state collector. */
export function createReportQaTable({esc, trNum, QA_LIMITS, DBH_REASON_TR}) {
  return function renderQaTable({qaRow, P, GQ, knotted, knotN, L, parkHa, covHa, deltaPct, dataset, dataYear, resolutionLabel, INV, nPhoto, NR, G, hdDetail, devDetail, snap, hash}) {
  const qaRows = [
    qaRow('Park geometrisi', knotted ? '⚠ Düğümlü sınır' : (P.osm_key || P.area_m2 > 0 ? true : false),
      `${GQ ? esc(GQ.source) : 'OSM poligonu <code>' + esc(P.osm_key || '—') + '</code>'} · ${trNum(parkHa, 2)} ha` +
      (knotted ? ` · <b>${knotN} kendini kesen segment çifti</b> (düğüm)${L ? '' : ' — arazi örtüsü çözümlemesi bu nedenle QA eşiğine takıldı'}` : knotN === 0 ? ' · kendini kesme yok (tarandı)' : GQ && GQ.self_intersections == null ? ' · düğüm taraması koşulmadı (halka > 600 nokta)' : '')),
    L ? qaRow('Raster kapsama', (L.cells || 0) > 0 && covHa > 0, `${L.cells || 0} kaynak hücre · kapsama ${covHa != null ? trNum(covHa, 2) + ' ha' : '—'}`) : null,
    L ? qaRow('Alan dengesi', deltaPct != null && deltaPct <= 0.5, deltaPct != null ? `raster/park alan farkı %${trNum(deltaPct, 3)} (eşik %0,500)` : '—') : null,
    L ? qaRow('Hücre–kesit hesabı', true, 'tam poligon–hücre kesişimi; sınır hücrelerinde alan ağırlıklı hesap') : null,
    L ? qaRow('Veri kaynağı', !!L.source, `${esc(dataset)} · yıl ${dataYear} · ${esc(resolutionLabel)}`) : null,
    L ? qaRow('Sınıflandırma', (L.classes || []).length > 0, `${(L.classes || []).length} sınıf${L.masked_ha > 0 ? ` · maskeli ${trNum(L.masked_ha, 2)} ha (bulut/gölge)` : ' · maskeli alan yok'}`) : null,
    L && L.agreement ? qaRow('Çapraz doğrulama', true, `${esc(L.cross || 'bağımsız kaynak')} uzlaşması: ${Object.entries(L.agreement).map(([k, v]) => `${esc(k)} %${trNum(v.agreementPct, 0)}`).join(', ')}`) : null,
    INV ? qaRow('Tür/grup kilidi', (INV.n_unknown === 0 && !(INV.group_fail||[]).length) ? true : `⚠ ${INV.n_unknown + (INV.group_fail||[]).length} kayıt uyuşmuyor`, `${INV.n_rows - INV.n_unknown - (INV.group_fail||[]).length}/${INV.n_rows} kayıt FINAL tür/grup sözleşmesiyle eşleşti${INV.unknown.length ? ' · sözlük dışında: ' + esc(INV.unknown.join(', ')) : ''}${(INV.group_fail||[]).length ? ' · yanlış grup: ' + esc((INV.group_fail||[]).map(x=>'P'+x.point_id).join(', ')) : ''}`) : null,
    qaRow('Fotoğraf kanıtı', nPhoto === NR ? true : `⚠ ${NR - nPhoto} eksik`, `${nPhoto}/${NR} kayıt sahada çekilmiş fotoğraf bağlantısı taşıyor`),
    qaRow('GNSS doğruluk kaydı', (G.n_with_acc ?? 0) > 0 ? true : '⚠ Kaydedilmedi', (G.n_with_acc ?? 0) > 0 ? `${G.n_with_acc}/${G.n ?? NR} kayıtta doğruluk değeri · ortalama ±${trNum(G.mean_acc_m, 1)} m` : `0/${G.n ?? NR} kayıtta accuracy_m değeri var — GNSS hassasiyeti bu sürümde SAYIYLA beyan edilemiyor; park üyeliği poligon testiyle doğrulandı`),
    /* (a) Ölçüm protokolü/geçerlilik kontrolü — ham çevre + türetilmiş DBH. */
    INV ? qaRow('Ölçüm protokolü (çevre → DBH)', INV.dbh_block ? '⛔ Blok' : (INV.dbh_fail.length ? '⚠ İnceleme' : true), INV.dbh_fail.length ? `${INV.n - INV.dbh_fail.length}/${INV.n} kayıtta türetilmiş DBH geçerli · ${INV.dbh_fail.length} kayıtta sorun (${INV.dbh_fail.slice(0, 8).map((x) => 'P' + x.point_id + ': ' + (DBH_REASON_TR[x.reason] || x.reason)).join('; ')}${INV.dbh_fail.length > 8 ? '; …' : ''})` : `${INV.n}/${INV.n} kayıtta ham göğüs çevresi korunmuş ve DBH = çevre / π olarak türetilmiştir; türetilmiş DBH ${QA_LIMITS.DBH_MIN_CM}–${QA_LIMITS.DBH_MAX_CM} cm aralığındadır`) : null,
    /* (b) Gövde formu (boy/çap) — 0032: İKİ katmanlı ölçüt. Fiziksel makullük
     * bandı (HD_PHYS_MIN–HD_PHYS_MAX) + stand İÇİ robust aykırılık (modified
     * z-score > HD_ROBUST_Z). Tipik 15–120 bandı dışı kayıtlar yalnız SAYILIR
     * ve bilgilendirme olarak beyan edilir: sabit bant, bütünüyle geniş gövdeli
     * formlu bir standı topluca "olağandışı" ilan ediyordu (Göksu: 32/34).
     * hd_block KALICI false (0031) — bu kalem ASLA bloklamaz. */
    INV ? qaRow('Boy/DBH oranı incelemesi', INV.hd_review ? '⚠ İnceleme' : true, hdDetail) : null,
    /* (c) Karbon yeniden hesabı — DBH tanımından BAĞIMSIZ, ayrı kalite kontrolü.
     * Saklı carbon_kg ile panel denkleminin karşılaştırılmasıdır; birim iddiası
     * içermez (0031). 0032: beklenen değer İKİ ρ kaynağıyla (tür düzeyi ρ ve
     * grup varsayılanı ρ) hesaplanır; saklı değer herhangi biriyle ±%20
     * içindeyse satır geçerlidir ve eşleşen kaynak SAYIYLA beyan edilir.
     * Motor, katsayılar ve saklı değerler DEĞİŞMEZ. */
    INV ? qaRow('Karbon yeniden hesabı', INV.dev_block ? '⛔ Blok' : (INV.dev_fail.length ? '⚠ İnceleme' : true), devDetail) : null,
    /* 0033 · (d) eşik tabanlı gövde sınıfı beyan satırı KALDIRILDI: rapor
     * hiçbir bireyin yasal statüsü hakkında hüküm vermez
     * (bkz. mc.YASAL_STATU_KAPSAM). Gövde çapı dağılımı §5.1 ve §9da
     * BETİMLEYİCİ olarak beyan edilir; eşik veya statü iddiası yoktur. */
    qaRow('Konum çiti', (snap.geofence.outside_rows || 0) === 0 ? true : '⚠ Kısmi', `${snap.geofence.verified_rows}/${snap.geofence.total ?? snap.geofence.verified_rows} kayıt poligon içinde`),
    qaRow('Moderasyon', snap.moderation.approved > 0, `${snap.moderation.approved}/${snap.moderation.approved} kayıt onaylı · zaman damgası ${snap.moderation.reviewed}/${snap.moderation.approved}`),
    qaRow('Rapor üretimi', true, `içerik hash'i <code>sha256:${hash.slice(0, 16)}…</code> (canlı doğrulama §7'de)`),
  ].filter(Boolean).join('');

    return qaRows;
  };
}
