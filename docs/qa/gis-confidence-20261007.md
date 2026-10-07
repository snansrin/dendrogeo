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

İlk yerel 2026 YTD denemesi Supabase uç noktasındaki DNS `EAI_AGAIN` hatasıyla durdu. Sonrasında CI üzerinden üç park için canlı koşu tamamlandı; ayrıntılar aşağıdadır. YTD taraması isteğe bağlı önizleme/kanıt olarak kalır, ham 2021 raster sınıflarını değiştirmez. Otomatik spektral uyum saha doğruluğu değildir.

### Son yayın kapısı kontrolü · 2026-10-07

- `npm run build` ile `index.html` kaynak partial'lardan yeniden üretildi; ardından `npm run check` başarıyla tamamlandı: **1.340/1.340 test**, syntax, sürüm hash'leri, build tutarlılığı ve CSP kontrolleri geçti.
- Uzak GitHub Actions koşusunda üç parkın geometrisi ve güncel 2026 Sentinel‑2 sahneleri başarıyla alındı; canlı rapor `docs/qa/gis-ytd-20261007.md` dosyasına işlendi.
- Yedek `--park`/Nominatim yolu ile Göksu yeniden denendi; `nominatim.openstreetmap.org` DNS'i de `EAI_AGAIN` verdi. Chromium kurulumu denendi, ancak Playwright CDN indirmesi sıfır bayt/bozuk arşiv döndürdü. Bu yüzden 360/390/430 px Playwright duman testi ve bu dal için CI mobil iş akışı çalıştırılamadı.
- Aday dal güncel `origin/main` (`8fe983772b288c0d481ced8e16be9a2dac13bc8a`) ile çakışmasız birleştirildi; birleştirilmiş adayda tam `npm run check` yeniden geçti (**1.340/1.340**).
- İlk uzak park koşusu, seçilen `S2_MODE` değerinin izole QA VM'ine aktarılmadığını gösterdi; değişken bağlamı düzeltildi ve regresyon testi eklendi. Yeni commit’te uzak üç park koşusu yeniden tetiklenecek.
- CI temel doğrulama adımları ve canlı park veri alımı geçti. Mobil test ilk koşuda kaydırılabilir tablonun 5 px iç taşmasını sayfa taşması sandı; bu bekçi düzeltildi ve yeni commit’te yeniden çalışıyor. Spektral kıyas 2021 referansına karşıdır; saha etiketi olmadan 2026 doğruluk hükmü vermez. Yayın kapısı mobil CI ve bağımsız, tarih uyumlu saha etiketleriyle gerçek doğrulama tamamlanana kadar **açık** tutulur.

### Canlı güncel yıl koşusu · GitHub Actions · 2026-10-07

Koşu: 2026-10-07 tarihine kadar 1 Ocak–bugün Sentinel‑2 L2A YTD. Üç parkta profillenen hücre sayısı tamdır. Aşağıdaki spektral uzlaşma, karşılaştırmanın zaman referansı 2021 WorldCover olduğu için zamansal değişimi de içerir; saha doğruluğu olarak okunmamalıdır.

| Park | Alan | Hücre | Profillenen | Genel spektral uzlaşma | Yeşil | Su | Sert zemin | Çıplak zemin |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Göksu Parkı | 50,01 ha | 7.864 | 7.864 | %66,3 | %88,1 | %51,6 | %44,9 | %32,4 |
| Başkent Millet Bahçesi | 56,77 ha | 8.919 | 8.919 | %73,0 | %85,1 | %0 (n=74 raster su hücresi) | %48,4 | %26,2 |
| Kuğulu Parkı | 1,17 ha | 210 | 210 | %83,7 | %95,9 | — (rasterda su hücresi yok) | %20,8 | — |

Göksu'da spektral sınıf farkı özellikle sert zeminde ve su kenarlarında; Başkent'te 2021 su sınıfı ile 2026 YTD spektrumu arasında; Kuğulu'da sert zeminde yüksektir. Bu oranlar otomatik olarak sınıf değişikliği gerekçesi değildir. Kuğulu'nun küçük alanı da örneklem gücünü sınırlar. Ham ESA kodları ve kabul edilmiş hücre kararları değiştirilmemiştir.

QA aracındaki OA/κ satırları spektral pseudo-reference örneklemesidir ve bilimsel hüküm değildir: Göksu n=40, OA %64,7, κ 0,51; Başkent n=40, OA %80,8, κ 0,50; Kuğulu n=20, OA %78,9, κ 0,25. Kuğulu n=30 eşiğinin altındadır. Bağımsız, 2026 ile tarih uyumlu ve tabakalı insan/saha etiketleri olmadan bu değerler doğruluk/validasyon iddiasına dönüştürülemez.
