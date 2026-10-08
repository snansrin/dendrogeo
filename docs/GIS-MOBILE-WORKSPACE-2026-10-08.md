# Canlı Harita GIS arayüzü — güvenli UX sürümü

**Tarih:** 8 Ekim 2026. **Referans:** onaylanmış analiz/su motoru `7680cab`, 51 dosyalı bilimsel kilit `d53b148`.

## Kullanıcı görev sırası ve menüler

1. **Dosya:** proje/park yönetimi, veri alma ve kaydetme.
2. **Görünüm:** altlık + geçici ölçme, parkı ortala, koordinata git/kopyala. Geçici araçlar yalnız harita üzerinde çalışır; analiz modundayken ve Park Analizi Modu yeni park seçiyorken açılmaz.
3. **Grid & Waypoint:** proje, 10/20/50 m çözünürlük, referans alan, güvenli mesafe, grid oluştur.
4. **Katmanlar:** canlı haritada grid ve waypoint görünürlüğü; ayrı bir alt bölümde yalnız PNG için görünecek katmanlar.
5. **Rapor & Çıktı:** PNG altlığı ve orijinal PNG İndir düğmesi; **en sağa sabitleme yok**, normal sırada Katmanlar'dan sonra.
6. **Yüzey fırçası**, **Sınır düzeltme** ve **Veri ve ayarlar:** mevcut analiz motorunun çalışan araçları; hesaplamalar değiştirilmez.

Menüler açıldığında tek panel görünür; masaüstünde bulunduğu menünün altına sığdırılır, mobilde görünür ekran içinde sabitlenen tek, kendi içinde kaydırılabilir panel kullanılır. Escape eski menü mekanizmasını kapatır. Araçların özgün DOM öğeleri taşınır, kopyalanmaz; ID, event handler ve Supabase verileri korunur.

## Mobil görünüm ve erişilebilirlik

- 320, 360, 390, 430 px ve tablet ekranları için araç satırı otomatik 3/4 sütun olarak dizilir.
- En az 44 px temel düğme, grid alanları ve ölçüm kontrolü; etiketler taşmadan satır kırabilir.
- Yüzey analizinde 3 sütunlu hassasiyet satırı taşma yapmaz; eşikler ve sayılar olduğu gibi kalır.
- Menü paneli `visualViewport` genişliği/yüksekliğine sınırlandırılır; harita ve Leaflet katmanlarının CSS geometri ölçüleri değiştirilmez.
- Erişim: gerçek label–input ilişkileri, canlı durum metni, odak ve menü kapanması, dokunma hedefleri.

## Bilimsel güvenlik

51 kilitli dosyanın hiçbirine dokunulmaz. Dünya örtüsü rasterı, Sentinel-2/OSM, geometri algoritmaları, hassasiyet barları, su maskesi ve kabul edilmiş raporlar sabittir. Görünüm araçlarındaki küresel/sferik mesafe-alan hesabı **yaklaşık geçici harita ölçümüdür**; analizde kullanılan UTM alan hesabı değildir, veri tabanına yazılmaz.

**En Yaygın 6 Tür** listesi ve mevcut onaylı kayıt yüzdeleri korunur; daha önce eklenen bağımsız “PNG indir” düğmesi çıkarılır. GIS rapor PNG indirmesi ise **Rapor & Çıktı** içinde kalır.

## İncelenen uygulama örnekleri

- QGIS: paneller, katman ağacı, nesne tanımlama, mesafe/alan ölçümü ve ayrı araç çubukları — https://documentation.qgis.org/testing/en/docs/user_manual/introduction/qgis_gui.html
- ArcGIS Map Viewer: içerik ve ayar araç çubuklarını ayırma, katman/görünürlük, altlık ve ölçüm — https://doc.arcgis.com/en/arcgis-online/get-started/get-started-with-mv.htm
- W3C WCAG 2.2: 320 CSS px tek yönlü yeniden akış, dokunma hedefleri — https://www.w3.org/WAI/WCAG21/Understanding/reflow ve https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum

## Kabul kontrolleri

`npm run check:surface-lock`, `npm run check`, `test/gis-workspace-ui.test.mjs`, 360/390/430 mobil smoke, 320 px CSS/DOM kontrolü, menü aç/kapa/yeniden park seç akışı, PNG kontrollerinin özgün tekil ID/handler'larla çalışması. Kod kilidi, model, veri ve görsel renkler değişmeyecek.
