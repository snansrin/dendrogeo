# ADR 0007: Katman sahipliğini ve mimari kabul kapsamını tamamlama

- Durum: Kabul edildi
- Tarih: 2026-10-14
- Yetki: Kullanıcı mevcut/hedef tablosuna göre modüler mimarinin tamamlanmasını, çalışan sistemi korumayı, test etmeyi ve main'e taşımayı açıkça istedi.

## Bağlam

Ölçüm/analiz akışlarının ayrılması, bütün fiziksel katman yerleşiminin tamamlanmasıyla aynı ölçüt değildi. Kaynak incelemesi application altında 33 DOM/form/harita kontrolcüsü, domain altında STAC transport/timeout ve rastgele UUID üretimi, ayrıca örtük saat varsayılanları buldu. Eski denetim DOM ve örtük zaman bağımlılıklarını application/domain sınırında reddetmiyordu.

## Karar

- Kanonik yapı ADR 0005/0006'daki alan bazlı katmanlı mimaridir: domain, application, adapters, ui, contracts, workers ve compatibility/composition servisleri.
- 33 ekran/harita kontrolcüsü UI katmanına taşınır. Modül kodunun byte içeriği, global API adı, callback kontratı ve sıra korunur. UI kontrolcüsü kullanıcı etkileşimini ve ekran akışını yönetebilir; veri erişimini enjekte edilen adapter portuna, bilimsel kuralı domain'e verir.
- STAC transport ve UUID üretimi adapter katmanına taşınır; byte içeriği ve global API adı korunur.
- Domain saati veya rastgeleliği kendisi okumaz. Sentinel dönemleri, yedek hatırlatıcısı, geofence audit ve inceleme provenance'ı explicit zaman girdileriyle hesaplanır. Eski servis/API girişleri aynı saati composition sınırında verir. Künye doğrulama/decode kuralları explicit today alır; browser/Node uyumluluk köprüsü mevcut çağrı imzasını korur.
- Mevcut testlerde taşınan modüllerin yalnız dosya yolu değişir. Künye bridge testindeki nesne kimliği varsayımı yerine korunan saf kurallar ve saat bağlı köprü kontratı denetlenir; bilimsel/validasyon beklentileri gevşetilmez.
- CI presentation ve platform kaçaklarını, domain örtük saat/rastgelelik/transport bağımlılıklarını, bare global ile sınır atlamayı ve adapter→application/UI ters bağımlılıklarını reddeder.

## Tamamlanma ölçütü

1. Bu kararın hedef tablosunda açık katman ihlali veya geçiş borcu yoktur.
2. Runtime modülleri yükleme/lazy/worker/precache zincirinde ve kritik dosyalar hash kilidindedir.
3. İlgili regresyonlar, tam check, gerçek Chromium telefon/harita akışları ve CI başarılıdır.
4. Yetkilendirilmiş main yayını canlı runtime/cache sürümü ve temiz tarayıcı açılışıyla doğrulanır.

ES module, yeni bundler, tüm uygulama için merkezi store veya klasörleri features ağacına taşıma bu mimarinin zorunlu kabul ölçütü değildir. Bunlar davranış ihtiyacı ve ayrı pilot/ADR gerektiren gelecek değişikliklerdir. Bu kabul, gelecekteki değişikliklerin hatasız olacağı garantisi veya bir sektör sertifikası değildir.
