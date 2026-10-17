# Bilimsel çekirdek ve araç kilidi — 17 Ekim 2026

Kullanıcı talimatıyla çalışan çekirdek `docs/core-foundation-lock.json` içinde SHA-256 ile korunur. Bu kayıt mevcut temel ve önceki yetkili değişikliklerin zincirini korur; eski hash'ler üzerine yazılmaz.

## Korunan davranışlar

| Alan | Koruma |
|---|---|
| Saha ölçümü ve allometri | Ham göğüs çevresi, tam hassasiyetli DBH = çevre / π dönüşümü, mevcut denklem ve katsayılar |
| Tür kataloğu | Kayıtlı türler, Latince adlar, türe özgü ve genel yapraklı/ibreli odun yoğunlukları |
| Park algılama | OSM sorguları, park kimliği ve sınır geometrileri |
| Yüzey analizi ve tarama | Ham raster, sınıflandırma, spektral tarama, kullanıcı kararları ve kabul edilmiş kayıt ayrımı |
| Harita araçları | Fırça, nesne seçimi, sınır çizimi, grid, waypoint, katman görünürlüğü ve dışa aktarım |
| Harita altlığı | Kullanıcının istediği 14 Ekim sürümü: uydu native 19, etkileşim zoom 22 |

## Denetim

- `npm run check:core-foundation`: kaynak hash'leri, manifest özeti ve yetkili değişiklik zinciri.
- `npm run check:modules`: yükleme sırası, offline kayıt ve kritik araçların kilitte bulunması.
- `npm run check`: kaynak, hesaplama ve mevcut regresyon testleri; CI'da da çalışır.
- `npm run check:phone`: gerçek Leaflet menüsünden grid oluşturma, yeşil alan filtresi, katman açma/kapama ve mevcut araç testleri.
- PNG regresyonu: “PARK SAHASI” altında fonksiyon metni yerine hesaplanan alan yazılır; alan değerleri değişmez.

Bu düzeltmede allometri, tür/yoğunluk girdileri ve raster sınıflandırma/alan hesaplama formülleri değiştirilmemiştir. Menüden taşınmış kontrollerin olay bağlantısı ve dışa aktarımın alan etiketi düzeltilmiştir. Kullanıcının ek hata bildirimiyle, raster hücrelerinin 10.000 adette sessizce kesilmesi kaldırılmış ve park sınırını gerçek OSM geometrisinden kurtaran bağımsız yedek eklenmiştir.

Harikalar Diyarı (OSM way/205225595) gerçek veri kontrolü: 88 sınır köşesi, WorldCover 2021 v200 verisinde 12.031 hücre, 766.644,602 m² düzenlenebilir hücre alanı ve aynı sınıflandırılmış alan. Önceki kod son 2.031 hücreyi aktarmazdı. `node scripts/lulc-qa.mjs --fixture harikalar` bu kamuya açık sınırla kontrolü yeniden çalıştırır. Karo birleştirme regresyonu ikinci karonun hücrelerinin de kaybolmamasını doğrular.

17 Ekim ek kullanıcı hata bildirimi: yeşil alan anahtarı kapalıyken `SweepLine tree` hatasıyla duran grid kesişimine, yalnız bu hata için tam sayı milimetre koordinatlarıyla bir yeniden deneme eklendi. Normal başarılı hesap aynı kalır. Aynı 0,001 m giriş hassasiyeti, engeller, park sınırı ve güvenlik mesafesi korunur; ikinci deneme de başarısızsa işlem hata verir, kesilmemiş parkı grid olarak sunmaz. `test/grid-precision-recovery.test.mjs` kurtarma ve hata kapılarını, kayıtlı Göksu geometrisinde iki anahtar durumunu ve veri değişmezliğini kontrol eder.

## Yerel push koruması

17 Ekim ikinci grid hata bildirimi: yalnız ölçek değiştirerek yeniden deneme Harikalar Diyarı için yeterli olmadı. İki SweepLine denemesi de başarısızsa grid adaptörü, aynı 0,001 m koordinat hassasiyetinde bağımsız Clipper tam sayı Boolean yedeğini kullanır. Kurtarma seçimi yalnız o grid işinde saklanır; sonraki grid olağan motorla başlar. Yedek yalnız grid işlemlerinde çağrılır; sınıflandırma, allometri, kayıtlı geometri ve olağan başarılı kesişimler değişmez. İç delikler, adacıklar, çoklu engeller ve güvenlik mesafesi regresyonla korunur. Her aday noktanın mesafesi ayrıca özgün park sınırı ve engellerle doğrulanır; Boolean çıktısı tek güvenlik kanıtı sayılmaz. `harikalar-grid-smoke.mjs`, gerçek kamuya açık WorldCover hücre geometrileriyle iki hata denemesini kontrollü olarak üretir; bu fikstür OSM iyileştirmesi veya kullanıcı düzeltmesi içermez. Kullanıcının ek talebiyle yalnız gezinme etiketleri “Ölçüm noktaları” olarak Türkçeleştirilmiştir; `nav` rotası, kontrol kimlikleri ve kayıt şeması korunur.

Bu çalışma kopyasında `npm run core:lock` ile `.githooks/pre-push` etkinleştirilir. Normal `git push`, çekirdek hash denetimi başarısızsa durur. Yeni bir klonda da aynı komutla etkinleştirilmelidir; yalnız hook dosyasının Git'te bulunması kanca kurmaz.

Kilitli kaynaklar sonraki arayüz işleri sırasında değiştirilmez. Kullanıcı açıkça belirli bir çekirdek düzeltmesi isterse değişiklik kapsamı, önceki/yeni SHA-256 değerleri ve ilgili regresyon kanıtı yeni bir yetkili kayıtla belgelenir. Hash'leri kendiliğinden yenileyen bir komut bulunmaz.
