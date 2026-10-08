# DendroGeo çalışma kuralları

## Kesin dondurulmuş analiz — r90, 8 Ekim 2026

Kullanıcı kilidin onarım sırasında da aşılmamasını yeniden açıkça istedi. Çalışan yayın `f58deb7f936263d8ae3eb3e14328a494684d1de0` (r90), geri dönüş `recovery/surface-panel-r90`.

- Analiz motoru, tam otomatik tarama, Tara/Yeniden Tara, hassasiyet barları, geometri, OSM maskeleri, görüntüleme, tema, yükleme, erişim imzası ve önbellek dondurulmuştur. `src/`, `css/`, `vendor/`, `partials/`, WorldCover imza fonksiyonu, giriş sayfası, SW, yayın sürümü ve bağımlılıklar korunur.
- Hata bildirimi, "düzelt", "çalışmıyor" veya genel geliştirme talebi kilidi açma izni DEĞİLDİR. Önce salt okunur teşhis ve somut öneri sunulur. Kullanıcı korunan dosyalar için açıkça "kilidi aç" demeden bu dosyalara yazılmaz.
- Hash/manifest güncellemek, koruma betiğini veya CI'ı değiştirmek, kontrolü atlamak, farklı dal üzerinden merge etmek, korumayı kaldırmak ve bu kuralı yeniden yorumlamak yasaktır. Temsilci korumayı kendi başına gevşetmez.
- Koruma dosyaları da korunur: `AGENTS.md`, `.github/workflows/`, `scripts/`, kilit manifesti ve kilit belgesi. Yeni CI kapısı PR kodunu çalıştırmaz; ana daldaki güvenilir betikle sabit r90'a karşı karşılaştırır. Kodla birlikte hash değiştirmek kontrolü geçirmez.
- Korunan dosyada değişiklik gerekiyorsa yalnız somut öneriyi hazırla; kullanıcının açık kilit açma talimatını bekle. Onay yoksa canlıya uygulama, sürüm artırma veya motor düzeltmesi yapma.
- Kapsam dışındaki işlerde mevcut koruma ve testler geçmelidir. Çalışan r90 yedeği silinmez veya ileri taşınmaz.


- Amaç, sahada telefonla güvenilir veri toplamaktır. 360, 390 ve 430 px genişliklerde taşma ve gereksiz kaydırmayı kontrol edin.
- Mevcut tema renklerini, yazı ailelerini (`--f-*`), yazı boyutu hiyerarşisini, buton sınıflarını ve durum renklerini koruyun. Yeni kontroller mevcut `btn`, `dg-png-btn`, `lbl`, `dg-meta` ve tema değişkenlerini kullanmalı.
- Açık/kapalı seçimlerde Yeni Ölçüm ekranındaki `input.dg-switch` tasarımını kullanın; tarayıcının ham checkbox görünümünü eklemeyin. Anlamlı etiket, klavye kullanımı ve odak göstergesi korunsun.
- Range kontrolleri genel metin alanı padding/width kurallarını miras almamalı. 0 ve 100 uçları telefon ekranında tam erişilebilir olmalı.
- Görsel sınır yumuşatması ve renk yoğunluğu bilimsel alan hesaplarını, kabul edilen geometriyi veya ham raster verisini değiştirmemeli. Önizleme ile kayıtlı sonuç açıkça ayırt edilmeli.
- Saha ham ölçümü, yerden 1,30 m yükseklikte mezurayla alınan göğüs çevresidir (`girth_cm`). DBH santimetre cinsinden `dbh_cm = girth_cm / π` ile türetilir; allometriye yalnız bu çap girer. Kullanıcıya DBH 1 ondalık basamakla gösterilir, hesapta tam hassasiyet korunur.
- Canlı kullanıcı konumu mevcut GPS izni ve paylaşım koşullarıyla, geçici olarak gösterilir. Kurucu ekranı mevcut yetkileri korumalı; filtreler yeni veri erişimi açmamalı.
- Yayından önce ilgili regresyon testleri, `npm run check`, telefon görünümü, CI ve canlı dosya sürümleri doğrulansın.
- Yüzey analiz motoru ve canlı harita DendroGeo ana çekirdeğidir; kapsam/izolasyon/test şartları için [`docs/CORE-KIRMIZI-CIZGILER.md`](docs/CORE-KIRMIZI-CIZGILER.md) kurallarını uygulayın.
