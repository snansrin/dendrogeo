export function createReportLimitationsPresentation({trNum, QA_LIMITS, YASAL_STATU_KAPSAM}) {
  return function renderLimitations({L, knotted, knotN, t, G, INV, HD, DB, govdeAralikTxt, tN}) {
  /* ---- Sınırlılıklar ---- */
  const limItems = [
    'Arazi örtüsü sonuçları, kullanılan veri kaynağının mekânsal çözünürlüğü, veri edinim tarihi ve sınıflandırma doğruluğu ile sınırlıdır. 10 m çözünürlükteki veri, küçük ve dar yüzeylerin bağımsız olarak temsil edilmesini her durumda mümkün kılmayabilir.',
    L?.review ? 'Kayıtlı analizde OSM nesne sınırları ve kullanıcı çizimleri sınıf alanlarını değiştirebilir; kaynak tarihi ve sınır doğruluğu saha doğrulaması gerektirir.' : 'OSM verileri yardımcı geometrik doğrulama amacıyla kullanılmış olup, eksik veya güncel olmayan OSM geometrileri analiz sonucunun tek başına belirleyicisi değildir.',
    knotted ? `Bu sürümde kullanılan park sınırı ${knotN} kendini kesen segment çifti (düğüm) içermektedir; arazi örtüsü çözümlemesi bu nedenle kalite eşiğini geçememiş ve rapor kapsamı dışında bırakılmıştır. Sınırın uygulamada yeniden çizilmesi (veya OSM poligonuna dönülmesi) önerilir.` : null,
    'Chave ve ark. (2014) pantropikal bir modeldir; Türkiye türleri için bölgesel kalibrasyon gerçekleştirilmemiştir.',
    `Envanter ${t.n} kayıtla sınırlıdır. Tüm ağaçların sayıldığına veya olasılıklı örnekleme tasarımının uygulandığına ilişkin kayıt bulunmadığından parkın toplam karbon stoku tahmin edilmemiştir.`,
    (G.n_with_acc ?? 0) > 0
      ? `GNSS doğruluğu (±${trNum(G.mean_acc_m, 1)} m) bireysel ağaç konumu için değil, park üyeliği doğrulaması için kullanılmıştır.`
      : 'GNSS alıcı doğruluğu (accuracy_m) bu veri sürümünde kaydedilmemiştir; konumsal doğrulama park poligonu üyelik testiyle sınırlıdır ve bireysel nokta hassasiyeti sayısal olarak beyan edilemez.',
    /* 0031 · ESKİ cümle: "boy/çap oranı blok verdi; ölçü birimi hatası (çevre
     * değeri çap kolonuna yazılmış olabilir) düzeltilmeden karbon
     * yayımlanmamalıdır" → DBH göğüs çapı (cm) olduğu için bu hüküm geçersizdi
     * ve gerçek saha verisini haksız yere blokluyordu. Yerine inceleme notu.
     * 0032 · ÖLÇÜT DEĞİŞTİ: sabit 15–120 bandı YERİNE (i) fiziksel makullük
     * bandı HD_PHYS_MIN–HD_PHYS_MAX ve (ii) stand İÇİ robust aykırılık
     * (modified z > 3,5). Tipik bant dışı SAYIM yalnız bilgilendirmedir:
     * bütünüyle geniş gövdeli bir standda oran doğal olarak düşüktür ve
     * sabit bant bu standı topluca "olağandışı" ilan ediyordu (32/34). */
    (INV && INV.hd_review) ? `Boy/DBH oranı ${INV.hd_fail.length}/${INV.n} kayıtta fiziksel makullük bandının (${QA_LIMITS.HD_PHYS_MIN}–${QA_LIMITS.HD_PHYS_MAX}) dışında veya stand içi dağılıma göre aykırıdır (modified z eşiği ${trNum(QA_LIMITS.HD_ROBUST_Z, 1)}). Bu oran bir İNCELEME GÖSTERGESİDİR: tür, yaş ve gövde formu farkları oranı doğal olarak değiştirir; saha ölçümünün hatalı olduğu anlamına gelmez ve rapor bu gerekçeyle bloklanmaz. DBH değerleri ham göğüs çevresinden D=C/π ile türetilmiştir; karbon hesabı yuvarlanmamış türetilmiş D ile yürütülmüştür.` : null,
    (INV && !INV.hd_review && INV.hd_band_out && INV.hd_band_out.length) ? `Boy/çap oranı ${INV.hd_band_out.length}/${INV.n} kayıtta tipik ${QA_LIMITS.HD_MIN}–${QA_LIMITS.HD_MAX} bandının dışındadır; bu bir UYARI DEĞİL, dağılım bilgisidir. Ölçüt olarak sabit bant yerine standın kendi dağılımı kullanılmış${HD ? ` (medyan ${tN(HD.medyan, 2)}, MAD ${tN(HD.mad, 3)}, aralık ${tN(HD.min, 2)}–${tN(HD.max, 2)}, en yüksek |z| ${tN(HD.z_max, 2)}; eşik ${trNum(QA_LIMITS.HD_ROBUST_Z, 1)})` : ''} ve hiçbir kayıt aykırı bulunmamıştır. ${DB ? `Oranın düşük kalması ham çevreden türetilen DBH değerleriyle ilgilidir — aralık ${govdeAralikTxt}: paydada büyük bir çap varken boy tipik orman değerlerinde kaldığında oran matematiksel olarak düşer. Bu dağılım tek başına ölçüm hatası kanıtı oluşturmaz.` : ''}` : null,
    /* 0033 · KAPSAM BEYANI (tek kaynak: mc.YASAL_STATU_KAPSAM). Rapor hiçbir
     * birey için yasal statü değerlendirmesi YAPMAZ. 0032deki eşik tabanlı
     * gövde sınıfı beyanı bu yüzden kaldırıldı: envanterde tescilli olmayan
     * bireyler bulunabilir ve bir ölçüm raporu tespit/tescil hükmü taşıyamaz.
     * Ölçülen değerler olduğu gibi modellenir; düzeltme uygulanmaz. */
    YASAL_STATU_KAPSAM,
    /* 0033 · model temsili sınırlılığı: geniş gövdeli bireyler allometrik
     * kalibrasyon örnekleminde düşük ağırlık taşır → belirsizlik geniştir.
     * Sınırlılık VERİDE değil, modelin temsil gücündedir. */
    (INV && DB) ? `<b>Gövde çapı dağılımı ve model temsili.</b> Bu envanterde ham göğüs çevresinden D=C/π ile türetilen DBH aralığı ${govdeAralikTxt}. Ham çevre değiştirilmemiş; allometriye yalnız yuvarlanmamış türetilmiş D uygulanmıştır. Modelin aktarılabilirliği şu sınırlamalara tabidir: kullanılan allometrik model (Chave ve ark. 2014) pantropikal bir kalibrasyon örneklemine dayanır. Sabit model değişim katsayısı, bölgesel kalibrasyon eksikliğini veya büyük çaplı kent ağaçlarına ilişkin model sapmasını ayrıca nicelleştirmez.` : null,
    (INV && INV.dbh_fail.length) ? `DBH geçerlilik kontrolünde ${INV.dbh_fail.length}/${INV.n} kayıt teknik açıdan sorunludur (eksik / sayısal değil / ≤ 0 / cm aralığı dışında); bu kayıtlar ayrıca incelenmelidir.` : null,
    /* 0031 · karbon yeniden hesabı DBH biriminden BAĞIMSIZ ayrı bir kontroldür. */
    (INV && INV.dev_block) ? `Saklı karbon değerleri ${INV.dev_fail.length}/${INV.n} kayıtta panel denklemiyle yeniden hesabın ±%${QA_LIMITS.CARBON_DEV_PCT} bandı dışındadır; bu bir HESAP BÜTÜNLÜĞÜ sorunudur (DBH birimiyle ilgili değildir) ve giderilene dek toplam geçicidir.` : null,
    (INV && INV.dev_review) ? `Karbon yeniden hesabı karşılaştırmasında ${INV.dev_fail.length}/${INV.n} kayıt ±%${QA_LIMITS.CARBON_DEV_PCT} bandı dışındadır. Bu, DBH biriminden bağımsız AYRI bir kalite kontrol kalemidir; ilgili noktalar ayrıca incelenebilir ancak karbon motorunu veya katsayıları değiştirmek için gerekçe oluşturmaz.` : null,
    (INV && INV.n_unknown > 0) ? `${INV.n_unknown} tür adı kanonik sözlük dışında kalmıştır (${INV.unknown.join(', ')}); FINAL kilit bu kayıtlar için karbon hesabına izin vermez.` : null,
    (INV && INV.group_fail && INV.group_fail.length) ? `${INV.group_fail.length} kayıtta tür ile seçilen grup uyuşmamaktadır; FINAL kilit bu kayıtlar için karbon hesabına izin vermez.` : null,
    L && L.masked_ha > 0 ? `Analiz alanının ${trNum(L.masked_ha, 2)} ha’lık bölümü bulut/gölge maskesi kapsamındadır; bu alan sınıf dağılımına dahil edilmemiştir.` : null,
  ].filter(Boolean).map((x) => `<li>${x}</li>`).join('');

    return limItems;
  };
}
