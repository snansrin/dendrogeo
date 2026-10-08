# DendroGeo ana çekirdek ve kırmızı çizgiler

## Güncel kilit — 8 Ekim 2026

Kullanıcının doğruladığı çalışan analiz `90f0b0a2aa80cf684de8fc45e0a37fb3dbd97807` sürümünde kilitlenmiştir. [Analiz kilidi](VERIFIED-ANALYSIS-LOCK.md) ve `AGENTS.md` kuralları önce gelir. Yeni geri dönüş noktası `recovery/verified-analysis-2026-10-08` dalıdır. Aşağıdaki 4 Ekim referansları önceki kurtarma tarihçesidir.

## Ürün kararı

4 Ekim 2026 itibarıyla saha, yüzey analizi ve canlı harita sistemi DendroGeo'nun ana ürün çekirdeğidir. Bu sürüm, yeni geliştirmelerin davranış tabanıdır. Kurtarma dalı `recovery/core-2026-10-04`, kullanıcı onayıyla ana dalda çalışan çekirdeğe ilerletilmiştir.

| Referans | Değer |
|---|---|
| Ana çekirdek | `main` — `61d4163a0a6d9d62d6b5f4f623894a6c9b57e29a` |
| Aktif kurtarma dalı | `recovery/core-2026-10-04` — aynı commit |
| Önceki sabit kurtarma noktası | `recovery/previous-core-e7d9439` — `e7d94399aa6a058538068b6e4cc0263ed68ffa34` |
| Çekirdek davranış özeti | [Tek yüzey analiz motoru](ANALIZ-TEK-MOTOR-2026-10-04.md) |
| Kurtarma ve doğrulama | [Kurtarma kılavuzu](KURTARMA.md) |

## Kırmızı çizgiler

- Yüzey analizi ve canlı harita bu ürünün temel akışıdır. Bu bileşenler kullanıcı isteği dışında yeniden tasarlanmaz, kapatılmaz, kaldırılmaz veya davranışları değiştirilmez.
- Ham yüzey sınıfları ESA WorldCover 2021 v200 verisinden ve gerçek raster hücresi–park sınırı kesişimlerinden gelir. Alanı hedef yüzdeye uydurmayın; kaynak hücreleri, kabul edilmiş geometriyi veya yayınlanmış sonucu sessizce değiştirmeyin.
- Yüzey Analizi açılışında Sentinel-2 taraması otomatik tamamlanır ve inceleme verisi sağlar; tarama tek başına sınıfları değiştirmez. Her yeni park/analiz taraması eşiklerde nötr 50 değerleriyle başlar. Kullanıcının hücre, fırça veya sınır kararı önceliklidir.
- Fırça, geçtiği raster hücrelerini tek tek sınıflandırır; yol/poligon çizimine dönüşmez. Ham raster ve kabul edilmiş sonuç, kullanıcı kararı olmadan değişmez.
- OSM yardımcı vektör verisidir; ham rasterın yerine geçmez ve yol çizgileri dolu yüzey poligonu sayılmaz. OSM hataları veya zaman aşımı yüzey analizi ve harita akışını kilitlememelidir.
- Canlı harita katmanları, waypoint ve navigasyon, ölçüm noktaları/fotoğrafları, canlı kullanıcı/ziyaretçi görünümü, fırça, görünürlük kontrolleri, doğrulanmış harita dışa aktarımı ve çevrimdışı ölçüm senkronizasyonu korunur. İzin, oturum koruması ve mevcut veri erişim kuralları gevşetilmez.
- Bilimsel alan/karbon hesapları, rapor anlık görüntüleri, kayıt kimlikleri ve DOI yayınları arayüz düzenlemesi sırasında etkilenmez. QA başarısızsa yayın kapısı aşılmaz.

## Geliştirme ve kabul ölçütü

Motor veya canlı haritayı etkileyen her iş ayrı bir dalda yapılır. Önce mevcut çekirdek commit'i ve geri dönüş yolu kayda alınır; değişiklik yalnız istenen kapsamda tutulur. İlgili regresyonlar, tam `npm run check`, CI, 360/390/430 px telefon görünümü ve canlı dosya sürümleri doğrulanmadan ana dala alınmaz. Yüzey motoru değişiklikleri en az Göksu Parkı, Başkent Millet Bahçesi ve Kuğulu Park verileriyle karşılaştırılır; sınıf alanları, QA farkı, fırça hücre kararları, geri alma, dışa aktarma ve kabul edilmiş sonuç kontrol edilir. Analiz verisi veya kaynak hatası varsa yöntem açıkça raporlanır; sonuçlar elle hedef değere zorlanmaz.

Saha çalışmasını durduracak bir arıza halinde önce düzeltme dalı değerlendirilir. Geri dönüş gerekirse etkin kurtarma commit'i ayrı worktree'de açılır; ana çalışma alanına `reset --hard`, force push, veritabanı geri yüklemesi veya yayın silme uygulanmaz.
