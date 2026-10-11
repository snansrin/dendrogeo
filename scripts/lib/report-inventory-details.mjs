/* Present inventory QA findings without changing thresholds or classification. */
export function createReportInventoryDetails({trNum, QA_LIMITS}) {
  return function renderInventoryDetails(INV) {
  /* Uzun nokta listelerini tabloda okunur tut (PDF/baskı düzeni bozulmasın). */
  const ptList = (arr, cap = 12) => {
    const ids = arr.map((x) => 'P' + x.point_id);
    return ids.length > cap ? ids.slice(0, cap).join(', ') + ` … (+${ids.length - cap} kayıt)` : ids.join(', ');
  };
  /* 0033 · Çizelge 4 ayrıntı metinleri: (b) gövde formu, (c) karbon ρ kaynağı.
   * Hepsi inventoryQa çıktısından TÜRETİLİR; sabit/elle yazılmış sayı yoktur.
   * tN: değeri olmayan hücrede 0 BASMAZ. */
  const tN = (x, d = 1) => (x == null || !Number.isFinite(+x) ? '—' : trNum(x, d));
  const DB = (INV && INV.dbh_stats) || null;
  const HD = (INV && INV.hd_stats) || null;
  const DR = (INV && INV.dev_rho) || null;
  /* 0033 · gövde çapı aralığı metni: envanterden TÜRETİLİR, eşik/statü yok. */
  const govdeAralikTxt = DB ? `${tN(DB.min, 1)}–${tN(DB.max, 1)} cm (medyan ${tN(DB.medyan, 1)} cm, n=${DB.n})` : null;
  const HD_TAIL = INV && INV.h_fail && INV.h_fail.length
    ? ` · ${INV.h_fail.length} kayıtta ağaç boyu fiziksel aralık dışında (${QA_LIMITS.H_MIN_M}–${QA_LIMITS.H_MAX_M} m): ${ptList(INV.h_fail)}`
    : '';
  const hdDetail = !INV ? null : (INV.hd_review
    ? `${INV.n - INV.hd_fail.length}/${INV.n} kayıt gövde formu açısından makul · ${INV.hd_fail.length} kayıt inceleme istiyor (${INV.hd_fail.map((x) => `P${x.point_id}: h/D ${tN(x.hd, 2)}${x.z != null ? `, z ${tN(x.z, 2)}` : ''} — ${x.reason === 'stand-aykiri' ? 'stand içi dağılıma göre aykırı (modified z > ' + trNum(QA_LIMITS.HD_ROBUST_Z, 1) + ')' : 'fiziksel makullük bandı (' + QA_LIMITS.HD_PHYS_MIN + '–' + QA_LIMITS.HD_PHYS_MAX + ') dışı'}`).join('; ')}) — tür, yaş ve gövde formu farklarından kaynaklanabilir; saha ölçümünün hatalı olduğu anlamına GELMEZ ve yayını bloklamaz${HD_TAIL}`
    : `${INV.n}/${INV.n} kayıt boy/çap oranı fiziksel makullük bandında (${QA_LIMITS.HD_PHYS_MIN}–${QA_LIMITS.HD_PHYS_MAX}) ve stand içi robust aykırılık testinde aykırı kayıt YOK (modified z eşiği ${trNum(QA_LIMITS.HD_ROBUST_Z, 1)})`
      + (HD ? ` · stand dağılımı: medyan ${tN(HD.medyan, 2)}, MAD ${tN(HD.mad, 3)}, aralık ${tN(HD.min, 2)}–${tN(HD.max, 2)}, en yüksek |z| ${tN(Math.abs(HD.z_max), 2)}` : '')
      + (INV.hd_band_out && INV.hd_band_out.length
        ? ` · ${INV.hd_band_out.length}/${INV.n} kayıt tipik ${QA_LIMITS.HD_MIN}–${QA_LIMITS.HD_MAX} bandının dışında: bu bir UYARI DEĞİL, BİLGİDİR — bu envanterin boy/çap dağılımı${HD ? ` (medyan ${tN(HD.medyan, 2)})` : ''} tipik orman bandının altında kalıyor; sabit bant karşılaştırması dağılım bilgisidir, kayıt bazlı hata hükmü değildir${govdeAralikTxt ? ` · türetilmiş DBH aralığı ${govdeAralikTxt}` : ''}`
        : '')
      + HD_TAIL);
  const devDetail = !INV ? null : (INV.dev_block
    ? `${INV.dev_fail.length}/${INV.n} kayıtta saklı karbon, FINAL kilitli ρ tablosuyla yeniden hesabın ±%${QA_LIMITS.CARBON_DEV_PCT} bandı dışında — SİSTEMİK hesap bütünlüğü sorunu; yayın düzeltme uygulanana dek bloklanır`
    : (INV.dev_fail.length
      ? `${INV.n - INV.dev_fail.length}/${INV.n} kayıt FINAL kilitli ρ tablosuyla ±%${QA_LIMITS.CARBON_DEV_PCT} içinde · ${INV.dev_fail.length} kayıt bant dışında (${INV.dev_fail.map((x) => `P${x.point_id}: saklı ${tN(x.stored)} kg ↔ beklenen ${tN(x.expected)} kg (%${tN(x.dev_pct)})`).join('; ')}) — tek yetkili hesap yolu budur`
      : `${DR && DR.n ? `${DR.n}/${INV.n} kayıt` : `${INV.n}/${INV.n} kayıt`} panel denklemiyle (Chave 2014 + FINAL kilitli ρ tablosu) ±%${QA_LIMITS.CARBON_DEV_PCT} içinde yeniden üretildi — bant dışı kayıt YOK`
        + (DR && DR.tur ? ` · ${DR.tur} kayıt kilitli tür ρ satırı kullandı` : '')
        + (DR && DR.grup ? ` · ${DR.grup} kayıt yalnız kendi grup genelini kullandı` : '')));

    return {tN, DB, HD, govdeAralikTxt, hdDetail, devDetail};
  };
}
