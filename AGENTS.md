# DendroGeo çalışma kuralları

- Amaç, sahada telefonla güvenilir veri toplamaktır. 360, 390 ve 430 px genişliklerde taşma ve gereksiz kaydırmayı kontrol edin.
- Mevcut tema renklerini, yazı ailelerini (`--f-*`), yazı boyutu hiyerarşisini, buton sınıflarını ve durum renklerini koruyun. Yeni kontroller mevcut `btn`, `dg-png-btn`, `lbl`, `dg-meta` ve tema değişkenlerini kullanmalı.
- Açık/kapalı seçimlerde Yeni Ölçüm ekranındaki `input.dg-switch` tasarımını kullanın; tarayıcının ham checkbox görünümünü eklemeyin. Anlamlı etiket, klavye kullanımı ve odak göstergesi korunsun.
- Range kontrolleri genel metin alanı padding/width kurallarını miras almamalı. 0 ve 100 uçları telefon ekranında tam erişilebilir olmalı.
- Görsel sınır yumuşatması ve renk yoğunluğu bilimsel alan hesaplarını, kabul edilen geometriyi veya ham raster verisini değiştirmemeli. Önizleme ile kayıtlı sonuç açıkça ayırt edilmeli.
- Saha ham ölçümü, yerden 1,30 m yükseklikte mezurayla alınan göğüs çevresidir (`girth_cm`). DBH santimetre cinsinden `dbh_cm = girth_cm / π` ile türetilir; allometriye yalnız bu çap girer. Kullanıcıya DBH 1 ondalık basamakla gösterilir, hesapta tam hassasiyet korunur.
- Canlı kullanıcı konumu mevcut GPS izni ve paylaşım koşullarıyla, geçici olarak gösterilir. Kurucu ekranı mevcut yetkileri korumalı; filtreler yeni veri erişimi açmamalı.
- Yayından önce ilgili regresyon testleri, `npm run check`, telefon görünümü, CI ve canlı dosya sürümleri doğrulansın.
- Yüzey analiz motoru ve canlı harita DendroGeo ana çekirdeğidir; kapsam/izolasyon/test şartları için [`docs/CORE-KIRMIZI-CIZGILER.md`](docs/CORE-KIRMIZI-CIZGILER.md) kurallarını uygulayın.
