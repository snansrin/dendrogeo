/* Immutable report §7 verification markup. QA decisions and row generation
 * are prepared by the report application and injected here unchanged. */
export function renderReportVerificationSection({QA_ST_LABEL, QA_BLOCKED, QA_WHY, QA_REVIEW, AGAC_DEGER_TEMIZ, qaStates, qaRows, id, verTxt, hash, snap}) {
  return `<h2><span class="no">7</span>Kalite Kontrol ve Doğrulama</h2>
<p>Sonuçlar üretilmeden önce hesaplamanın bütünlüğü aşağıdaki kontrollerle doğrulanmıştır (Çizelge 4). Kontroller otomatiktir. Rapor QA durumu üç hâllidir: <b>🔴 BLOKLU</b> — kritik veri hatası vardır, karbon sonucu bilimsel iletişimde kullanılmamalıdır; <b>🟡 İNCELEME</b> — veri geçerlidir, bazı istatistiksel kontroller inceleme uyarısı vermektedir; <b>🟢 GEÇERLİ</b> — tüm kritik kontroller geçmiştir. <b>Bu raporun QA durumu: ${QA_ST_LABEL}</b>${QA_BLOCKED ? ` — kritik hata: ${QA_WHY}. Karbon toplamı bu nedenle GEÇİCİDİR ve hata giderilmeden bilimsel iletişimde KULLANILMAMALIDIR.` : (QA_REVIEW ? ` — inceleme kalemleri: ${QA_WHY}. Bu uyarılar birer inceleme kalemidir; veri hatası hükmü DEĞİLDİR ve karbon sonucunun geçerliliğini ortadan kaldırmaz.${AGAC_DEGER_TEMIZ ? ' Bu rapordaki inceleme kalemlerinin HİÇBİRİ ağaç ölçüm değerleriyle (DBH, boy, tür, karbon) ilgili DEĞİLDİR: envanter kontrollerinin tümü geçerlidir; kalan kalem/kalemler ölçülemeyen veya kaydedilmeyen üst veri alanlarıdır (ör. GNSS alıcı doğruluğu accuracy_m boş bırakılmışsa bu kontrol koşamaz).' : ''}` : '')}${qaStates.includes('info') ? ' Çizelge 4’te ayrıca <b>ℹ️ BEYAN</b> işaretli bilgilendirme satırları bulunabilir: bunlar bir kalite hükmü DEĞİLDİR ve rapor durumunu etkilemez.' : ''} Karbon hesabı, sahada ölçülen göğüs çevresinden D=C/π ile türetilen yuvarlanmamış DBH (cm) değerleri kullanılarak gerçekleştirilmiştir; rapor tablolarında DBH 1 ondalık basamakla gösterilir.</p>
<!-- 0032 · Çizelge 4 düzeni: sabit kolon genişlikleri (colgroup) + .qd ayrıntı hücresi.
     Eski hâlde ayrıntı kolonu monospace ve overflow-wrap:anywhere idi; uzun Türkçe
     cümleler kelime ortasından kırılıp tabloyu şekilsiz gösteriyordu. -->
<div class="tscroll"><table class="qa"><colgroup><col class="ck"><col class="cs"><col class="cd"></colgroup><thead><tr><th>Kontrol</th><th>Sonuç</th><th>Ayrıntı</th></tr></thead><tbody>${qaRows}</tbody></table></div>
<div class="verify">
 <b>Rapor kimliği:</b> <code>${id}</code> · sürüm ${verTxt} · yayın ${snap.generated_at.slice(0, 10)}<br>
 <b>İçerik hash'i:</b> <code>sha256:${hash}</code><br>
 <span id="dgVerify" class="sans">⏳ içerik bütünlüğü hesaplanıyor…</span><br>
 ${(snap.geofence.outside_rows || 0) === 0
   ? `✅ Konum çiti: ${snap.geofence.verified_rows}/${snap.geofence.total ?? snap.geofence.verified_rows} kayıt park poligonu içinde doğrulanmıştır.`
   : `⚠ Konum çiti: ${snap.geofence.verified_rows}/${snap.geofence.total} kayıt park poligonu içinde doğrulanmıştır; ${snap.geofence.outside_rows} kayıt poligon dışında koordinat taşımaktadır. Bu kayıtlar, konum çiti zorunluluğunun (0007) yürürlüğe girişinden önce üretildiği için geriye dönük olarak poligon denetimine tabi tutulamamıştır; karbon hesabına dahillerdir ancak mekânsal doğrulamaları bulunmamaktadır.`}<br>
 ${snap.moderation.reviewed === snap.moderation.approved
   ? `✅ Moderasyon: ${snap.moderation.approved}/${snap.moderation.approved} kayıt onaylı ve zaman damgalıdır.`
   : `⚠ Moderasyon: ${snap.moderation.approved}/${snap.moderation.approved} kayıt moderatör onaylıdır; zaman damgası (reviewed_at) ${snap.moderation.reviewed}/${snap.moderation.approved} kayıtta mevcuttur — onay zaman damgasının yazımı 0007 sonrası akışta zorunludur, önceki onaylar damgasızdır.`}<br>
 🔗 Kalıcı kimlik: ${id} + içerik hash'i${'' /* R2: Zenodo DOI eklendiğinde buraya işlenir */}.
</div>`;
}
