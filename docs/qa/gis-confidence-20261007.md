# GIS güven düzeyi — üç park canlı karşılaştırması

Tarih: 7 Ekim 2026. WorldCover 2021 v200 ham rasterı değiştirilmeden işlendi ve 2021 vejetasyon sezonundan Sentinel‑2 L2A çok tarihli medyan profiliyle karşılaştırıldı. Bu uzlaşma, saha doğruluğu değildir: bağımsız elle etiketlenmiş referans verisi yoktur. Aşağıdaki “uyum” raster hücrelerinin spektral yorumla eşleşme oranıdır; QA karne bölümündeki örnek OA da yalnız hattın çalıştığını gösteren spektral sahte-referans değeridir.

| Park | Alan | Raster hücresi | Sentinel profilli | Genel uyum | Yeşil | Su | Sert zemin | Çıplak zemin | QA örnek OA / κ |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Göksu Parkı | 50,01 ha | 7.864 | 7.702 | 70,5% | 88,3% | 71,5% | 38,4% | 37,2% | 74,0% / 0,62 |
| Başkent Millet Bahçesi | 56,77 ha | 8.919 | 8.758 | 59,7% | 65,5% | 28,2% | 58,5% | 31,1% | 66,7% / 0,33 |
| Kuğulu Park | 1,17 ha | 210 | 210 | 80,4% | 93,0% | — | 17,4% | — | 68,9% / 0,05 |

Başkent’te ESA su grubunun yalnız %28,2’si spektral olarak eşleşti. Kuğulu rasterında su hücresi bulunmadı; bu, parkta su yapısı yok demek değildir. Göksu sert zemin uyumu %38,4, Kuğulu’da %17,4 kaldı. Bu sınıfları otomatik ve kesin saha tespiti olarak sunmak doğru olmaz. Bağımsız saha gözlemi veya güncel, etiketli yüksek çözünürlüklü referans gereklidir.

## Değişiklikler

- COG byte-range istekleri, toplam 30 saniyelik sınır içinde kısa deneme zaman aşımı, üçe kadar deneme ve HTTP 408/429/5xx geçici hata yönetimi uygular; iptal ve kalıcı hatalar saklanmaz. Gerçek veri aralığı `206` olarak doğrulandı.
- Yeni analizlerde OSM bina, su ve işaretlenmiş sert zemin sınırları varsayılan görünür; kullanıcı kapatabilir. OSM ayrı vektör kanıtıdır, ham raster sınıfını değiştirmez. Yalnız açıkça kabul edilen düzeltmeler kayda alınır. Kapsamın eksik olabileceği arayüzde belirtilir.
- Kapalı `landuse=basin` ve `building:part` sınırları su/bina kanıtı olarak ayrı işlenir; multipolygon su geometrilerinin iç boşlukları korunur.
- Yeterli gözlem bulunan yeşil hücreler park içindeki NDVI medyanı dağılımına göre seyrek/orta/yoğun görselleştirilir. Bu yalnız göreli görünüm katmanıdır; raster sınıfı veya alan hesabını değiştirmez.
- Harita araçlarında sınır çizme, köşeyi geri alma, çizimi iptal etme, son sınırı geri alma, OSM nesnesini seçip onaylama ve ESC ile çizimi iptal etme bulunur.

Önceki raster/2021 koşusunun doğrulaması: `npm run check` — 1.337 test geçti; üç parkın canlı raster + Sentinel‑2 QA koşusu tamamlandı. Sentinel‑2 kaynağında geçici AbortError’lar görüldü; istek yeniden denemeleriyle bütün park koşuları tamamlandı. Sonraki 2026 tarama dönemi kodu ve regresyonları bu sayfanın “Güncel 2026 tarama dönemi” bölümünde ayrıca raporlanır.

Gerçek World Imagery karolarıyla yapılan sınırlı, tarih ve georegistrasyon farkları içeren keşif amaçlı görüntü kontrolü [`gis-visual-crosscheck-20261007.md`](gis-visual-crosscheck-20261007.md) içindedir. Bu bölüm saha doğruluğu iddiası değildir.

## Güncel 2026 tarama dönemi

Yüzey düzenleyicide Sentinel‑2 tarama seçeneklerine `Güncel yıl · 1 Ocak–bugün` eklendi. Bu mod, güncel UTC yılının bugüne kadar olan uygun L2A sahnelerini ve mevcut ilkbahar/sonbahar su pencerelerini kullanır; gelecekteki tarihler aralığa girmez. Önceden var olan `Güncel görüntüler · son 120 gün` seçeneği varsayılan olarak korunur. `2021` seçeneği tarih uyumlu karşılaştırmadır.

Güncel Sentinel‑2 profili kanıt/önizleme üretir; ham ESA WorldCover 2021 raster kodlarını veya kabul edilmiş kullanıcı kararlarını otomatik değiştirmez. ESA WorldCover'ın yayımlanmış global haritaları 2020 ve 2021 referans yıllarıdır. Esri'nin benzer 10 m yıllık Sentinel‑2 ürününün 2025 verisi yayımlanmıştır; 2026 yıllık ürünü olarak sunulamaz. Kaynaklar: [ESA WorldCover veri erişimi](https://esa-worldcover.org/en/data-access), [Esri 2025 ürün güncellemesi](https://www.esri.com/about/newsroom/arcnews/latest-land-cover-data-release-shows-more-change-over-time).

Bu oturumda 2026 yılbaşından bugüne Sentinel‑2 park koşusu Supabase park geometrisi uç noktasında DNS `EAI_AGAIN` nedeniyle başlayamadı; dolayısıyla yeni YTD seçeneği için üç parklı canlı sonuç/uyum ölçülmedi ve seçenek varsayılan yapılmadı. Kod tarih aralığı ve su penceresi testlerinden geçti. Canlı üç park QA'sı tamamlanınca 2026 önizlemesinin sınıf kararları ve alan farkı ayrıca değerlendirilmeli; otomatik doğruluk oranı saha etiketi yerine kullanılmamalı.

### Son yayın kapısı kontrolü · 2026-10-07

- `npm run build` ile `index.html` kaynak partial'lardan yeniden üretildi; ardından `npm run check` başarıyla tamamlandı: **1.340/1.340 test**, syntax, sürüm hash'leri, build tutarlılığı ve CSP kontrolleri geçti.
- 2026 canlı park koşusu tekrar denendi; uygulamanın Supabase REST alan adı `EAI_AGAIN` ile çözümlenemedi. Salt-okuma park sorgusunda Göksu geometrisi mevcut, Başkent geometrisi boş ve Kuğulu adıyla eşleşen kayıt dönmedi. Bu nedenle üç park için güncel veri koşusu üretilemedi.
- Yedek `--park`/Nominatim yolu ile Göksu yeniden denendi; `nominatim.openstreetmap.org` DNS'i de `EAI_AGAIN` verdi. Chromium kurulumu denendi, ancak Playwright CDN indirmesi sıfır bayt/bozuk arşiv döndürdü. Bu yüzden 360/390/430 px Playwright duman testi ve bu dal için CI mobil iş akışı çalıştırılamadı.
- Aday dal güncel `origin/main` (`8fe983772b288c0d481ced8e16be9a2dac13bc8a`) ile çakışmasız birleştirildi; birleştirilmiş adayda tam `npm run check` yeniden geçti (**1.340/1.340**).
- İlk uzak park koşusu, seçilen `S2_MODE` değerinin izole QA VM'ine aktarılmadığını gösterdi; değişken bağlamı düzeltildi ve regresyon testi eklendi. Yeni commit’te uzak üç park koşusu yeniden tetiklenecek.
- Park bazlı 2026 doğrulaması, mobil görünüm ve uzak CI tamamlanmadığından yayın kapısı **açık**. Kod `main`e alınmış veya push edilmiş değildir. Bu sonuçlar, önceki 2021 referans QA'sından ayrı tutulmalıdır.
