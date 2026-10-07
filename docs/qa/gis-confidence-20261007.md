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

Doğrulama: `npm run check` — 1.333 test geçti; üç parkın canlı raster + Sentinel‑2 QA koşusu tamamlandı. Sentinel‑2 kaynağında geçici AbortError’lar görüldü; istek yeniden denemeleriyle bütün park koşuları tamamlandı.
