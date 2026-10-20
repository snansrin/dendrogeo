# DendroGeo çalışma kuralları

## Ücretsiz Supabase kotası — zorunlu çalışma sınırı

- Supabase Logs Query, `query_logs`, `get_logs`, Management Analytics/Logs API ve CLI ile günlük okumak varsayılan olarak YASAKTIR. Hata ayıklama, güvenlik denetimi, Oracle bağlantı denemesi veya genel "kontrol et/düzelt" talebi günlük taramasına izin sayılmaz.
- Önce yerel kaynakları, mevcut oturum kayıtlarını, sentetik testleri ve GitHub Actions kayıtlarını kullanın. Usage sayfası sayaçlarını okumak ile proje günlüklerini taramak farklı işlemlerdir. Logs/Invocations ekranlarını otomatik açmayın; otomatik yenileme veya günlük API polling kurmayın.
- Günlük sorgusu ancak kullanıcıya hizmet, kesin zaman aralığı ve sorgu sayısı açıklanıp kullanıcı bu belirli taramayı açıkça istediğinde yapılabilir. Taranacak bayt bilinmiyorsa bunu söyleyin; `LIMIT` veya dar sonuç listesini küçük tarama bütçesi gibi sunmayın. Onay yoksa sorgu çalıştırmayın ve nedenini açıklayın.
- Canlı Supabase/Oracle erişimini regresyon testlerine eklemeyin. Günlük taraması, tam tablo/fotoğraf indirmesi, yük testi veya tekrarlayan sağlık denemesiyle hata çözmeyin. Bir hata için aynı canlı okuma en fazla bir kez tekrar denenir; sonra yerel kanıtlara dönülür.
- Bu kural proje asistanları için bağlayıcıdır; Supabase tarafında teknik bir kota kesicisi veya geçmiş tüketimi geri alma mekanizması değildir. Ayrıntılar: `docs/SUPABASE-FREE-PLAN-BUDGET.md`.

- Amaç, sahada telefonla güvenilir veri toplamaktır. 360, 390 ve 430 px genişliklerde taşma ve gereksiz kaydırmayı kontrol edin.
- Mevcut tema renklerini, yazı ailelerini (`--f-*`), yazı boyutu hiyerarşisini, buton sınıflarını ve durum renklerini koruyun. Yeni kontroller mevcut `btn`, `dg-png-btn`, `lbl`, `dg-meta` ve tema değişkenlerini kullanmalı.
- Açık/kapalı seçimlerde Yeni Ölçüm ekranındaki `input.dg-switch` tasarımını kullanın; tarayıcının ham checkbox görünümünü eklemeyin. Anlamlı etiket, klavye kullanımı ve odak göstergesi korunsun.
- Range kontrolleri genel metin alanı padding/width kurallarını miras almamalı. 0 ve 100 uçları telefon ekranında tam erişilebilir olmalı.
- Görsel sınır yumuşatması ve renk yoğunluğu bilimsel alan hesaplarını, kabul edilen geometriyi veya ham raster verisini değiştirmemeli. Önizleme ile kayıtlı sonuç açıkça ayırt edilmeli.
- Saha ham ölçümü, yerden 1,30 m yükseklikte mezurayla alınan göğüs çevresidir (`girth_cm`). DBH santimetre cinsinden `dbh_cm = girth_cm / π` ile türetilir; allometriye yalnız bu çap girer. Kullanıcıya DBH 1 ondalık basamakla gösterilir, hesapta tam hassasiyet korunur.
- Canlı kullanıcı konumu mevcut GPS izni ve paylaşım koşullarıyla, geçici olarak gösterilir. Kurucu ekranı mevcut yetkileri korumalı; filtreler yeni veri erişimi açmamalı.
- Yayından önce ilgili regresyon testleri, `npm run check`, telefon görünümü, CI ve canlı dosya sürümleri doğrulansın.
- Yüzey analiz motoru ve canlı harita DendroGeo ana çekirdeğidir; kapsam/izolasyon/test şartları için [`docs/CORE-KIRMIZI-CIZGILER.md`](docs/CORE-KIRMIZI-CIZGILER.md) kurallarını uygulayın.

- 17 Ekim çekirdek kilidi: allometri, tür/odun yoğunluğu girdileri, park algılama, yüzey analizi/tarama ve harita araçlarını kullanıcı açıkça bu kapsamda değişiklik istemedikçe değiştirmeyin. Hashleri otomatik yenilemeyin. Koruma ve push kancası: `docs/SCIENTIFIC-CORE-FREEZE.md`.
