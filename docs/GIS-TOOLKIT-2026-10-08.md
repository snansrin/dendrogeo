# DendroGeo GIS araç takımı · 2026-10-08

## Kapsam

Bu modül DendroGeo canlı harita görünümüne ayrı bir **GIS Araçları** menüsü ekler. Görünüm mevcut renkleri, başlıkları, fontları ve buton sınıflarını kullanır. Yüzey motorunun 33 kilitli dosyası değiştirilmez.

### Gerçek işlevler

| Araç | Davranış |
|---|---|
| Koordinat yakalama | Haritaya tıkla; WGS84 decimal, DMS, UTM zonu, EPSG kodu ve doğu/kuzey değerlerini göster/kopyala. |
| Mesafe ölçümü | Haritaya köşe ekle; büyük daire mesafesini topla, ilk doğrultuyu göster, bitir/geri al/temizle. |
| Alan ve çevre | Geçici poligon ve yaklaşık küresel alan/çevre; 1 ha = 10.000 m². |
| Nesne sorgulama | Park geometrisinde ve hazır yüzey katmanı önizlemesinde tıklanan noktayı incele; sınıflandırma veya hesap değiştirme. |
| Konum bulma | Koordinatla anında odaklan veya Nominatim üzerinden tek kullanıcı başlatmalı yer adı sorgusu. |
| Katmanlar | Mevcut grid/waypoint anahtarlarına güvenli erişim, altlık değişimi, mevcut sınıflardan lejant. |
| Ölçek / parkı göster | Leaflet yerleşik metrik ölçek kontrolü ve park sınırına odaklanma. |
| Cihaz konumu | Kullanıcı izin verdiğinde geçici yer belirleme ve cihazın verdiği GPS doğruluğunu gösterme. |
| Yer işaretleri | Cihaz tarayıcısında en fazla 12 adlandırılmış merkez noktası; aç, sil, sakla. |
| QGIS çıktı | Kullanıcının **geçici** ölçüm geometrisinden EPSG:4326 GeoJSON, KML ve nokta koordinatlı CSV indir. |

### Bilimsel sınırlar

- Araç ölçümleri **yaklaşık WGS84 küresel** hesabıdır. Kadastro ölçüsü, ortofoto doğrulaması veya yayımlanmış park yüzey alanlarıyla eş tutulmaz.
- ESA WorldCover, Sentinel-2, OSM raster/sınıf, yoğunluk barları, fırça, mod, DOI, kayıt, Supabase ve onaylı raporlar bu araçlarca **asla güncellenmez**.
- Aktif fırça, sınır çizimi, OSM nesne seçimi veya park seçimi sırasında GIS ölçümünü başlatma engellenir. GIS katmanları yalnızca geçici görüntü çizimleridir.
- Nominatim sorgusu kullanıcı isteğiyle ve tek sefer çalışır; üçüncü taraf servis 9 saniyede yanıt vermezse sonuç üretilmez. Yeni API anahtarı, kullanıcı takibi veya sunucu veri kaydı eklenmez.
- GeoJSON, KML, CSV orijinal veri kümesinden bağımsız ölçüm çıktılarıdır; QGIS üzerinde açılabilir ancak resmi yüzey analizinin yerine geçmez.
- Profesyonel masaüstü QGIS'in bütün eklentilerini, raster cebrini ve veritabanı analizini tarayıcıda sunma iddiası yoktur.

### Kullanım

1. Canlı Harita → GIS Araçları.
2. Ölçümde "Mesafe" veya "Alan" seç; haritaya köşeleri ekle. Çift tıklama veya mobil araç çubuğundaki ✓ ile tamamla. ↶ son noktayı, ✕ bütün geçici çizimi siler.
3. "Koordinat" veya "Nesne" seçerek harita üzerine dokun; bilgi menüde açılır.
4. Ölçüm en az 2 nokta içeriyorsa GeoJSON/KML/CSV dosyalarını indir.
5. Grid ve waypoint katmanlarını mevcut sistem anahtarlarından aç/kapat. "Parkı göster" ile seçili parkın sınırlarına yakınlaş.
6. Konumu yer işareti olarak kaydetmek için harita merkezini istediğin yere getir, isim yaz, ☆'a bas.

### Test / yayına hazırlık

- `npm run check:surface-lock` — kilit manifestindeki 33 dosya değişmez.
- `npm run check` — mevcut regresyonlar + GIS matematik/çıktı testleri.
- CI mobil 360/390/430 px; görünüm/panel, katman kontrolü, çizim sonlandırma, Enter/Escape, çevrimdışı yeni CSS/JS paket.
- Göksu Parkı, Başkent Millet Bahçesi, Kuğulu Parkı alan ve kaynak analizleri önceki sürümle sayısal olarak **aynı** kalır; bu PR bilimsel hesap kodunu değiştirmez.
- Bir hata görülürse yalnız GIS modülü geri alınır; kilitli çekirdek veya kayıtlı raporlar sıfırlanmaz.
