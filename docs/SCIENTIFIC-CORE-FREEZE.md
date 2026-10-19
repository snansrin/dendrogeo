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

19 Ekim 2026: Kullanıcı isteğiyle landing turu tamamen kaldırıldı. Turun üç sunum dosyasının son SHA-256 değerleri, yetkili silme kaydında saklanır; denetim bu dosyaların bulunmadığını da doğrular. Önceki kilit kayıtları ve analiz motorlarının koruması sürer. Landing, park ve yüzey analizini, OSM nesne sınıflandırmasını ve sınır araçlarını kısa teknik açıklamalarla tanıtır.

- `npm run check:core-foundation`: kaynak hash'leri, manifest özeti ve yetkili değişiklik zinciri.
- `npm run check:modules`: yükleme sırası, offline kayıt ve kritik araçların kilitte bulunması.
- `npm run check`: kaynak, hesaplama ve mevcut regresyon testleri; CI'da da çalışır.
- `npm run check:phone`: gerçek Leaflet menüsünden grid oluşturma, yeşil alan filtresi, katman açma/kapama ve mevcut araç testleri.
- PNG regresyonu: “PARK SAHASI” altında fonksiyon metni yerine hesaplanan alan yazılır; alan değerleri değişmez.

Bu düzeltmede allometri, tür/yoğunluk girdileri ve raster sınıflandırma/alan hesaplama formülleri değiştirilmemiştir. Menüden taşınmış kontrollerin olay bağlantısı ve dışa aktarımın alan etiketi düzeltilmiştir. Kullanıcının ek hata bildirimiyle, raster hücrelerinin 10.000 adette sessizce kesilmesi kaldırılmış ve park sınırını gerçek OSM geometrisinden kurtaran bağımsız yedek eklenmiştir.

Harikalar Diyarı (OSM way/205225595) gerçek veri kontrolü: 88 sınır köşesi, WorldCover 2021 v200 verisinde 12.031 hücre, 766.644,602 m² düzenlenebilir hücre alanı ve aynı sınıflandırılmış alan. Önceki kod son 2.031 hücreyi aktarmazdı. `node scripts/lulc-qa.mjs --fixture harikalar` bu kamuya açık sınırla kontrolü yeniden çalıştırır. Karo birleştirme regresyonu ikinci karonun hücrelerinin de kaybolmamasını doğrular.

17 Ekim ek kullanıcı hata bildirimi: yeşil alan anahtarı kapalıyken `SweepLine tree` hatasıyla duran grid kesişimine, yalnız bu hata için tam sayı milimetre koordinatlarıyla bir yeniden deneme eklendi. Normal başarılı hesap aynı kalır. Aynı 0,001 m giriş hassasiyeti, engeller, park sınırı ve güvenlik mesafesi korunur; ikinci deneme de başarısızsa işlem hata verir, kesilmemiş parkı grid olarak sunmaz. `test/grid-precision-recovery.test.mjs` kurtarma ve hata kapılarını, kayıtlı Göksu geometrisinde iki anahtar durumunu ve veri değişmezliğini kontrol eder.

## Yerel push koruması

17 Ekim grid/PNG ek hata bildirimi: `output ring` tamamlanma hatası, SweepLine hatasıyla birlikte birincil ve ölçekli grid denemelerinde tanınır; karma hata sıraları bağımsız yedeğe geçer. Standart yüzey PNG indirmesi artık yapay bir hücre düzeltmesi istemez: kabul edilmemiş veya yeniden düzenlenmiş analiz “PARK ANALİZİ ÖNİZLEMESİ” başlığı, açık durum notu ve ayrı dosya adıyla indirilir. Kabul edilmiş kayıt mevcut harita başlığını korur. İndirme kabul/yayın oluşturmaz, kayıt ve alanlara yazmaz; NDVI veri yeterlilik ve yayın kapıları değiştirilmez. Gerçek Harikalar yüzey geometrisiyle önizleme/kayıtlı PNG indirmesi tarayıcıda kontrol edilir.

17 Ekim ikinci grid hata bildirimi: yalnız ölçek değiştirerek yeniden deneme Harikalar Diyarı için yeterli olmadı. İki SweepLine denemesi de başarısızsa grid adaptörü, aynı 0,001 m koordinat hassasiyetinde bağımsız Clipper tam sayı Boolean yedeğini kullanır. Kurtarma seçimi yalnız o grid işinde saklanır; sonraki grid olağan motorla başlar. Yedek yalnız grid işlemlerinde çağrılır; sınıflandırma, allometri, kayıtlı geometri ve olağan başarılı kesişimler değişmez. İç delikler, adacıklar, çoklu engeller ve güvenlik mesafesi regresyonla korunur. Her aday noktanın mesafesi ayrıca özgün park sınırı ve engellerle doğrulanır; Boolean çıktısı tek güvenlik kanıtı sayılmaz. `harikalar-grid-smoke.mjs`, gerçek kamuya açık WorldCover hücre geometrileriyle iki hata denemesini kontrollü olarak üretir; bu fikstür OSM iyileştirmesi veya kullanıcı düzeltmesi içermez. Kullanıcının ek talebiyle yalnız gezinme etiketleri “Ölçüm noktaları” olarak Türkçeleştirilmiştir; `nav` rotası, kontrol kimlikleri ve kayıt şeması korunur.

17 Ekim ek grid kapsamı bildirimi: “Sadece yeşil alan” kapalıyken park bütünü başlangıç geometrisi seçiliyordu; ardından yeşil olmayan arazi örtüsü parçaları engel olarak çıkarılarak kapsam tekrar yeşil alanlara daralıyordu. Bu sınıf engelleri yalnız anahtar açıkken uygulanır. Anahtar kapalıyken grid park geometrisini kapsar; park dışına taşma ve açık çizgisel engeller için mevcut güvenlik denetimleri korunur. Modüler worker ve uyumluluk yolu aynı kuralla güncellendi; kabul edilmiş analiz verileri değişmez.

17 Ekim iletişim adresi güncellemesi: genel iletişim, güvenlik bildirimi, KVKK/gizlilik talepleri, lisans izni ve R istemci bakım adresleri `security@dendrogeo.org` kullanır. Akademik makale ve veri kümesi künyelerindeki yazar/sorumlu yazar e-postaları yazar iletişim bilgisi olarak korunur.

17 Ekim eski park PNG yolundaki geç yüklenen sınıf kataloğu düzeltmesi: `park-export.js` başlangıçta sınıf listesini yakalayamadığında analiz fonksiyonunu geçici yedek olarak tutuyordu; PNG çizicisi bu değerde `.find()` çağırınca çıktı hata verebiliyordu. Yeni UI köprüsü yalnız eksik `.find()` erişimini ekler ve sınıf listesini çağrı anında okur. Analiz fonksiyonunu çalıştırmaz; sınıflandırma, kabul edilmiş alanlar, hesaplama, harita araçları ve yeni GIS PNG akışı değişmez. Kilit ve üç hedefli regresyon testi bu modüler eklemeyi izler.

17 Ekim Playwright tarayıcı uyumluluğu: harita PNG/CSV duman testleri, `Download.createReadStream()` veya geçici dosya akışına bağlı kalmak yerine üretilen Blob içeriğini, MIME türünü ve dosya adını doğrular. Bu, Chromium headless sürümleri arasındaki indirme yaşam döngüsü farkını kaldırır; uygulama indirme kodunu ya da harita çıktısını değiştirmez.

Bu çalışma kopyasında `npm run core:lock` ile `.githooks/pre-push` etkinleştirilir. Normal `git push`, çekirdek hash denetimi başarısızsa durur. Yeni bir klonda da aynı komutla etkinleştirilmelidir; yalnız hook dosyasının Git'te bulunması kanca kurmaz.

Kilitli kaynaklar sonraki arayüz işleri sırasında değiştirilmez. Kullanıcı açıkça belirli bir çekirdek düzeltmesi isterse değişiklik kapsamı, önceki/yeni SHA-256 değerleri ve ilgili regresyon kanıtı yeni bir yetkili kayıtla belgelenir. Hash'leri kendiliğinden yenileyen bir komut bulunmaz.

2026-10-18: Kullanıcı v3.0.1 Zenodo yayını, yeni DOI’nin güncel atıflara işlenmesi, README ve rozet/lisans düzenlemesini açıkça istedi. Yetkili geçiş yalnız paket sürümleri, JSON-LD/landing atfı, üretilen index ve r441 önbellek sürümüdür. Eski/yeni SHA zinciri manifestte kaydedildi. Allometri, tür/odun yoğunluğu, park/yüzey/grid hesapları ve harita zoom ayarları değiştirilmedi; dondurulmuş raporlar korundu.

2026-10-18: Kullanıcı, giriş yapmış kişinin yenileme sonrasında aynı çalışma modülünde kalmasını ve düzeltmenin yayımlanmasını istedi. Son modül `dg_last_view` üzerinden doğrulanarak geri yüklenir; standart `go()` akışı harita ve modül başlatmalarını çalıştırır. Yönetim sekmeleri profil rolü gelene kadar bekletilir, yetkisiz rollere açılmaz. Anonim giriş, OAuth ve parola kurtarma akışları korunur. Aynı yetkili yayın geçişinde önceki landing talepleri (İngilizce yöntem, yalnız etkileşimli Göksu sahnesi ve sürüm dipnotu) tamamlandı. Allometri, tür/yoğunluk, park algılama, yüzey/grid analizi ve harita zoom davranışı değiştirilmedi.

2026-10-18: Rapor geri çekme kuyruğu aktif mühürlü rapor bırakmadığında, tema duman testi rapor okuyucu fikstürünü zorunlu tutmaz; yayımlanmış rapor varsa hash/okuyucu testleri, yoksa geçersiz bağlantı ve boş dizin kontrolleri çalışır. Rapor dosyaları ve yayın durumu değiştirilmedi.

2026-10-18: Kullanıcı, test paketindeki başarısızlıkların düzeltilmesini istedi. Landing sürüm kontrolü güncel arayüz ve künye etiketlerini doğrular; sitemap kontrolü yalnız geçerli aktif raporları bekler ve boş arşivde geri çekilmiş DGR yollarını reddeder. Başlangıç regresyonu son görünümün geri yüklenmesini doğrular. Bilimsel hesaplama ve analiz davranışları değiştirilmedi.

2026-10-18: Atatürk Çocukları ve Doğal Yaşam Parkı yol genişliği bildirimi. Kamuya açık OSM yol çizgilerinde genişlik bulunmadığı doğrulandı; otomatik yol varsayımları ve motor korunur. Seçili çizgisel OSM yolunu kullanıcı tarafından belirtilen metre genişliğiyle park içinde önizleyen ayrı domain/application/UI modülleri eklendi. Önizleme kayıt yazmaz; açık uygulama mevcut sınır kararı ve kabul akışına gider. Kullanıcı genişliği sonraki OSM taramasında silinmez. Daraltma bu ek araçta reddedilir; değişken kenarlar mevcut Sınır çiz aracıyla belirlenir. Allometri, türler, park algılama, raster ve kayıtlı kabul geometrileri kendiliğinden değiştirilmez.
