/* Data-derived method statements; calculations remain with the report engine. */
export function createReportMethodPresentation({esc, trNum, fmtDateTr}) {
  return function renderMethod({snap, G, NR, nPhoto, L, dataset, epsg, deltaPct}) {
  /* §4.1 saha protokolü metni VERİDEN türetilir: hangi alanın nasıl
   * kaydedildiği veri tablosundan okunur; bilinmeyen hassasiyet ASLA
   * uydurulmaz (0011 öncesi satır, accuracy_m NULL iken "±0,0 m" basıyordu). */
  const RWS = snap.rows || [];
  /* FINAL ölçüm protokolü: mezura ile çevre ölçülür; DBH çevre/π ile türetilir. */
  const dbhcTxt = 'Sahada mezura ile ağacın yerden 1,30 m yüksekliğindeki <b>göğüs çevresi</b> santimetre (cm) cinsinden ölçülmüştür. Ham çevre <code>girth_cm</code> alanında korunmuş; gerçek göğüs çapı (DBH; <i>Diameter at Breast Height</i>) her kayıt için <b>DBH = çevre / π</b> bağıntısıyla türetilerek <code>dbh_cm</code> alanına yazılmıştır. Allometrik modele ham çevre değil, bu türetilmiş DBH çapı uygulanmıştır.';
  const hbRows = RWS.filter((r) => Number.isFinite(+r.height_m) && (+r.height_m * 10) % 1 === 0).length;
  const gnssTxt = (G.n_with_acc ?? 0) > 0
    ? ` (kaydedilen doğruluk: ${G.n_with_acc}/${G.n ?? NR} kayıt · ortalama ±${trNum(G.mean_acc_m, 1)} m)`
    : ` — ancak alıcı doğruluk değeri (accuracy_m) bu veri sürümünde kaydedilmediğinden GNSS hassasiyeti sayısal olarak beyan edilememektedir; konumsal doğrulama park poligonu üyelik testiyle sınırlıdır (§7)`;
  const photoTxt = (nPhoto === NR) ? 'zorunlu tutulmuş ve tüm kayıtlarda sağlanmıştır' : `kısmen sağlanmıştır (${nPhoto}/${NR} kayıt)`;
  const lulcMethod = L?.accepted ? `<p><b>4.4 Kayıtlı analiz sonucu.</b> ${esc(fmtDateTr(L.accepted_at))} tarihinde kabul edilmiş sınıf alanları yayın isteğinden alınmıştır. Eski kayıt ayrıntılı geometri taşımadığından yeni harita üretilmemiştir. Bu yayın için uydu analizi yeniden çalıştırılmamıştır.</p>` : L?.review ? `<p><b>4.4 Kayıtlı analiz sonucu.</b> ${esc(fmtDateTr(L.review.acceptedAt))} tarihinde kabul edilen analiz, yayın isteğine sabitlenerek aktarılmıştır. Bina ve havuzlar ayrı sınıftır; OSM nesne sınırları ve kullanıcı çizimleri park sınırına kırpılmıştır. Sayısal değerler ve harita aynı kayıtlı geometriden gelir. Uydu verisinin 10/20 m çözünürlük sınırı ile harita geometrilerinin tarih ve doğruluk sınırlamaları geçerlidir; bu kayıt bağımsız saha doğrulaması sayılmaz.</p>` : L ? `<p><b>4.4 Arazi örtüsü sınıflandırması.</b> Arazi örtüsü sınıflandırması, park sınırı içerisinde mekânsal çözünürlüğü 10 m olan raster veri (${esc(dataset)}) ile gerçekleştirilmiştir. Sınıflandırma sonuçları park geometrisi ile kesiştirilerek değerlendirilmiş; sınır hücrelerinde alan ağırlıklı hesaplama uygulanmıştır${epsg ? ` (analiz projeksiyonu: ${esc(epsg)})` : ''}. Bulut/gölge gölgesinde kalan hücreler maskelenmiş ve sınıf toplamına dahil edilmemiştir${L.masked_ha > 0 ? ` (bu sürümde ${trNum(L.masked_ha, 2)} ha)` : ''}. Raster kapsama alanı ile park geometrisi alanı arasındaki bağıl fark %0,5 eşiğini aşarsa sonuç YAYINLANMAZ; bu sürümde fark %${trNum(deltaPct ?? 0, 3)} olarak ölçülmüştür (Çizelge 3).</p>` : '';

    return {dbhcTxt, hbRows, gnssTxt, photoTxt, lulcMethod};
  };
}
