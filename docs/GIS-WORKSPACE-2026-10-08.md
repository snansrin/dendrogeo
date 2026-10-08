# DendroGeo GIS çalışma alanı · kullanım ve uygulama planı

**Tarih:** 8 Ekim 2026  
**Referans:** `DG-SURFACE-LOCK-2026-10-08` / onaylı motor commit'i `f6a68b7b5fe075ce280bd566d04d5e021e0dba9a`  
**Kırmızı çizgi:** Kilit manifestindeki 33 dosya, analiz motoru, veri, eşikler, GIS geometrisi, kullanıcı taslağı, kaydedilmiş rapor ve tema/buton renkleri değişmez.

## Kullanım analizi — mevcut sorunlar

- Park ilk seçildiğinde Grid & Waypoint ile Katmanlar zaten üst menüye taşınsa da ayrı "3 · RAPOR PNG" kartı ve ona bağlı "Görünüm Katmanları" alanı aşağıda duruyor; kullanıcı aynı katmanın canlı haritaya mı PNG'ye mi ait olduğunu anlayamıyor.
- `parkInfo` kapsayıcısında park, analiz CTA'sı, raster raporu ve hassasiyet paneli aynı görsel hiyerarşide kalıyor. Harita ekranından daha çok formlara odaklanılıyor.
- GIS menüleri aynı anda çok sayıda eylem gösteriyor; neden-sonuç/durum metinleri eylemlerden ayrışmıyor. Kullanıcı "Haritadan nesne seç" ile "Tara" arasındaki farkı keşfetmek zorunda kalıyor.
- `src/services/dash.js`, "En Yaygın 6 Tür" sıralamasını ve yüzde barlarını zaten hesaplayıp oluşturuyor. Yeniden sınıflandırmaya gerek yok. Eksik olan, bu grafiğin erişilebilir sunumu ve ayrı PNG indirmesi.
- Mobile 360/390/430 pikselde açılır panel yüksekliği ve dokunulabilir alanların tutarlı olması gerekiyor.

## Görev modeli: doğru sırada beş temel eylem

**Park seç → yüzeyi tara → gerekirse doğrula/düzelt → saha grid/waypoint planla → kaydet/dışa aktar.**

Kullanıcının günlük ihtiyaçları üç görev profiline ayrılır:
1. **Saha kullanıcısı:** proje, grid boyutu, su/sert mesafesi, bekleyen/tamamlanan waypoint, navigasyon, ölçüm. Konum, hedef ve harita ilk bakışta görünmeli.
2. **GIS doğrulayıcısı:** altlık, görünürlük, ham/işlenmiş karşılaştırma, OSM nesnesi, fırça, sınır çizimi, geri al, uydu tarih aralığı, QA durumu.
3. **Araştırmacı/yayıncı:** onaylı saha kayıtları ve tür çeşitliliği, alan sınıfları, bilimsel veri kaynakları, görsel rapor PNG, CSV/GeoJSON ve QGIS uyumlu çıktı.

## Menü bilgi mimarisi

| Üst menü | Birincil işlev | İkincil/ileri eylem |
|---|---|---|
| Dosya | proje/park seç, doğrulanmış harita, veri indir | karar sıfırlama yalnız uyarılı gelişmiş alan |
| Görünüm | altlık, ham/işlenmiş görünüm | eşik/anlam açıklaması, karşılaştırma |
| Grid & Waypoint | proje, çözünürlük, referans alan, güvenli mesafe, grid oluştur | yeşil alan koşulu, grid özeti |
| Katmanlar | canlı grid/waypoint görünürlüğü | yalnız PNG'ye dahil edilecek seçenekler, birbirinden açıkça ayrılmış |
| Rapor & Çıktı | PNG altlığı, PNG indir | diğer çıktı türleri Dosya'da; seçimler orijinal DOM kimlikleriyle paylaşılır |
| Yüzey fırçası | sınıf, boyut | hücre bazlı düzeltme (motor değişmez) |
| Sınır düzeltme | nesne seç/çiz/tamamla | son köşe/sınır geri al, doğrulama |
| Veri ve ayarlar | OSM yardımcı sınır seçeneği, uydu tarama dönemi | teknik kaynak ve QA açıklamaları |

Park seçme ve yüzey analiz modunda yalnız ilgili menüler görünmeli. Mümkünse tek menü açık kalır; kapanma `Escape`, klavye `Tab` ve dokunmayla yapılabilir. Kullanıcı haritayı kaydırırken bir form yanlışlıkla açık kalıp haritanın üstünü kapatmamalı.

## Fazlar ve güvenli uygulama

**Faz 1 — mevcut işlevlerin düzenlenmesi (bu PR):**
- Kilitli kodu değiştirmeyen ek CSS ve DOM düzenleyicisi; eski kontroller `append` ile taşınır, klonlanmaz; ID ve onchange/click fonksiyonları aynen kalır.
- `Rapor & Çıktı` üst menüsü; `Görünüm Katmanları` seçenekleri `Katmanlar` altında "yalnız PNG" etiketiyle ayrılır.
- Grid formu iş akışına uygun başlık/iki sütun (mobil tek sütun); analiz başlatma ana çağrı olarak park özetinde kalır.
- `En Yaygın 6 Tür` yüzdeleri mevcut DOM'dan okunarak PNG'ye çizilir; hesaplama tekrarlanmaz; diğer istatistikler korunur.
- Panel genişliği, kaydırma, odak, dokunmatik erişim, başlık ve ipucu hiyerarşisi için ek stil; mevcut renk değişkenleri kullanılır.

**Faz 2 — keşfedilebilirlik ve profesyonel harita araçları (ayrı PR):**
- Parka odaklan, ölçek çizgisi, koordinat kopyala, mevcut projeye git, kolay arama/filtre ve katman açıklamaları.
- Uzun/alan ölçer, işaret/etiket, geçici çizim, seçili nesne özellikleri gibi yeni GIS araçları ayrı modüllerde ve doğrulama testleriyle eklenir; mevcut yüzey analizini değiştirmez.
- Harita katmanlarının canlı durumu, çıktı seçimi ve kayıtlı karar farklı state/başlıklarda gösterilir.

**Faz 3 — saha, rapor ve QGIS entegrasyonu (ayrı PR):**
- Daha hızlı mobil saha navigasyonu, sabit hedef bilgisi, waypoint filtreleri, proje/geometri/katman arama.
- QGIS uyumlu kaynak metadatası, CRS, sınıf lejandı, GeoJSON/CSV/KML/shapefile çıktı formatlarının gerçek kalite kontrolü.
- Kaydet/kabul et/dışa aktar eylemlerinde veri kökeni, QA ve revizyon görünürlüğü.

**Faz 4 — kabul ve yayın:**
- Göksu, Başkent Millet Bahçesi, Kuğulu Parkı regresyonu; alan/topoloji ve sayısal sonuç farkı **0** (sunum kaynaklı değişim yok).
- Chrome/Firefox/Safari, 360/390/430 px, klavye erişimi, CORS/uydu başarısızlığı, yeni park seçimi, grid oluşturma, fotoğraf/ölçüm ve PNG çıktısı.
- `npm run check:surface-lock`, `npm run check`, CI, mobil smoke ve Pages sürüm eşleşmesi başarılı olmadan `main`e alınmaz.

## Profesyonel arayüz referansları

- QGIS dock/katman mantığı ve ArcGIS Experience Builder'ın harita, görünürlük, lejand, ölçüm, altlık işlevlerini modüllere ayırması.
- W3C WAI-ARIA APG "Disclosure Navigation": yerleşik `details/summary`, klavye erişimi, `Escape` ve gizlenen alanların odak yönetimi.
- Analiz kartında özet, detay, doğrulama, dışa aktarma ayrı işlev; ölçümlerle sunum birbirinden bağımsız.

## Bilimsel/ürün uyumu

"Gelişmiş GIS" yeni verinin otomatik olarak doğru algılandığı anlamına gelmez: Sentinel-2 / WorldCover çözünürlükleri ve OSM veri kalitesi değişmez. Eksik veri "doğrulanmış" olarak sunulmaz. PNG bir sunum çıktısıdır, bilimsel raporun veya kabul edilmiş analizin yerine geçmez. Bir GIS kontrolü mevcut motorda yoksa sahte çalışan düğme değil, gerçek teknik geliştirme ve ayrı test gerekir.
