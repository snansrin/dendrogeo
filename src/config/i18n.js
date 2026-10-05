Warning: truncated output (original token count: 25165)
Total output lines: 1256

"use strict";
/* ===== DendroGeo · src/config/i18n.js — TR/EN ÇALIŞMA-ZAMANI DİL KATMANI (0035) =====
 * Kullanıcı isteği: "EN'e basıldığında site komple İngilizce olmalı, app de aynı
 * şekilde; basıldıktan sonra EN yerine TR gelmeli."
 *
 * MİMARİ — sözlük tabanlı, markup'a dokunmayan çevirmen:
 *   · Markup'taki varsayılan dil HER ZAMAN Türkçe (SEO, JSON-LD ve 940+ test
 *     Türkçe metinleri kilitliyor; data-i18n kalabalığı yerine tam-eşleşme
 *     sözlüğü seçildi → partials değişmeden çeviri çalışır).
 *   · dgApplyI18n(): kök altındaki metin düğümlerini + placeholder/title/
 *     aria-label özniteliklerini gezerek TAM EŞLEŞEN dizeleri çevirir.
 *     Eşleşmeyen diziğe DOKUNULMAZ (formüller, veriler, tür adları, sayılar).
 *   · TR'ye dönüş: DG_I18N_EN tersine çevrilir (EN→TR haritası otomatik).
 *   · MutationObserver: dil EN iken sonradan render edilen düğümler (tablo
 *     satırları, panel kartları, toast'lar) da sözlükte varsa çevrilir.
 *   · Kalıcılık: localStorage 'dg_lang'; <html lang> güncellenir.
 *   .notranslate / translate="no" / script / style / svg / textarea ATLANIR
 *   (Leaflet panoları ve harita DOM'u korunur — 2026-09-26 dersi).
 *
 * KAPSAM SINIRI (bilinçli): KVKK açık rıza metni hukuki metindir, TR kalır.
 * Tür adları (İBRELİ/YAPRAKLI/…) veritabanı anahtarıdır, çevrilmez.
 * Değişken gömülü dinamik dizeler (toast'lardaki sayılı mesajlar) v1'de TR;
 * sözlüğe tam dize eklemek yeterli — altyapı hazır. */

/* ---- EN sözlüğü: anahtar = TR dizenin trim'lenmiş hâli ---- */
const DG_I18N_EN={
"Renk yoğunluğu":"Color opacity",
"Uydu tarama dönemi":"Satellite scan period",
"Güncel görüntüler · son 120 gün":"Recent imagery · last 120 days",
"Tarama, bugün ile 120 gün öncesi arasındaki uygun Sentinel-2 görüntülerini arar. Bulut nedeniyle kullanılan tarihler daha eski olabilir. Altlık haritasının tarihi ve 2021 raster verisi ayrıdır.":"The scan searches suitable Sentinel-2 imagery from the last 120 days. Clouds may mean older dates within this period are used. Basemap dates and the 2021 raster are separate.",
"Güncel yüzey önizlemesi":"Current surface preview",
"Kaydırıcılar ve sınır düzeltmeleri bu özete yansır. Yayın için kabul edip kaydedin.":"Sliders and boundary edits update this summary. Accept and save it for publication.",
"Ham 2021 raster sonucu":"Original 2021 raster result",
"Kullanıcı ara":"Find users",
"İsim veya cihaz":"Name or device",
"Tüm ekranlar":"All screens",
"Yalnız konum paylaşanlar":"Only users sharing location",
"Görünümü duraklat":"Pause display",
"Haritayı takip et":"Follow map",
"Geçici izleri göster":"Show temporary trails",
"🗺️ Tümünü göster":"🗺️ Show all",

"Yüzey değişti. Waypoint üretmeden önce gridi yeniden oluşturun.":"The surface changed. Rebuild the grid before creating waypoints.",
"Haritada yeni parkın içine dokunun.":"Tap inside the new park on the map.",
"Yeni konum":"New location",
"Su ve sert zeminden uzaklık":"Distance from water and hard surfaces",
"Yüzey önizlemesi":"Surface preview",
"Kayıtlı yüzey":"Saved surface",
"uygun alan":"usable area",
"Ayarlar → Gizlilik ve Güvenlik → Konum Servisleri → Safari Siteleri → Uygulamayı Kullanırken.":"Settings → Privacy & Security → Location Services → Safari Websites → While Using the App.",
"Kayıtlı analiz sonucu":"Saved analysis result",
"Yayın isteğinde bu kayıt rapora aktarılır. Kaydedilmemiş önizleme rapora girmez.":"This saved result is attached to your publication request. Unsaved previews are excluded.",
"Bina ve havuz alanları ayrı hesaplanır.":"Buildings and pools are calculated separately.",
"nesne sınırı":"object boundaries",
"OSM bina, su ve sert zemin sınırlarını kullan":"Use OSM building, water and paved boundaries",

"Yüzey düzenleme açılamadı: ":"Surface review could not be opened: ",
"Cihaz önbelleği yazılamadı.":"Device cache could not be written.",
"Yüzey düzenleme":"Surface review",
"Tara, haritada ayarla, doğru gördüğün sonucu kaydet.":"Scan, adjust on the map, and save the result you reviewed.",
"hücre":"cells",
"Uydu altlığının tarihi bu tarihlerden farklı olabilir. Küçük bina ve havuzlar için sınır düzeltmesini kullanın.":"The basemap date may differ from these acquisitions. Use boundary review for small buildings and pools.",
"Tüm sınıflar":"All surface classes",
"Görüntüyü göster":"Show imagery",
"Renkleri göster":"Show class colors",
"Kabul et ve kaydet":"Accept and save",
"Bina / havuz sınırını düzelt":"Review a building / pool boundary",
"Sınıfı seç, haritada sınır köşelerine dokun, çizimi tamamla. Çizilen alan park sınırına kırpılır.":"Select a class, tap boundary corners on the map, then finish. The boundary is clipped to the park.",
"Yüzey türü":"Surface type",
"Sert / yapılı alan":"Hard / built surface",
"Bina":"Building",
"Havuz / süs havuzu":"Pool / ornamental pool",
"Sınır çiz":"Draw boundary",
"Çizimi tamamla":"Finish boundary",
"Son köşeyi sil":"Remove last corner",
"Veri ve ayarlar":"Data and settings",
"Kaydırıcı eşikleri değiştirir; çözünürlüğü veya doğruluk garantisini artırmaz. Kabul, görsel inceleme kararınızı kaydeder.":"Sliders change thresholds, not resolution or guaranteed accuracy. Acceptance records your visual review.",
"Son 120 gün":"Last 120 days",
"Kayıtlı sonuç":"Saved result",
"Kayıtlı sonuç korunuyor. Kaydırıcıyı değiştirerek yeni önizleme yapabilirsiniz.":"The saved result is preserved. Move a slider to start a new preview.",
"Önizleme henüz hesap kaydına yazılmadı.":"The preview has not been saved to your account.",
"Hesap kaydı yüklenemedi; cihaz taslağı kullanılıyor.":"Account data could not be loaded; using the draft on this device.",
"Cihaz kaydı başarısız. Kaydet düğmesiyle hesap kaydını deneyin.":"Device storage failed. Use Save to try account storage.",
"Park sınırı veya veri değişti; eski kararlar yeni veriye uygulanmadı.":"The park boundary or data changed; previous decisions were not applied to new data.",
"Tarama tamamlandı. Renkleri haritada kontrol edin.":"Scan finished. Review the class colors on the map.",
"Görüntüdeki sınıfı seçerek bu hücreyi düzeltin.":"Choose the class visible in the imagery to review this cell.",
"Önce tarama veya sınır düzeltmesi yapın.":"Scan or review a boundary first.",
"Hesaba kaydetmek için giriş yapın ve kayıtlı bir park seçin.":"Sign in and select a registered park to save to your account.",
"✓ Sonuç hesabınıza kaydedildi; başka cihazda da açılabilir.":"\u2713 The result was saved to your account and can be opened on another device.",
"Hesaba kaydedilemedi: ":"Could not save to account: ",
"Taslak bu cihazda saklandı.":"The draft was stored on this device.",
"Haritada sınır köşelerine dokunun; ardından çizimi tamamlayın.":"Tap boundary corners on the map, then finish the drawing.",
"En az üç köşe seçin; sınır kendi üzerine kesişmemeli.":"Select at least three corners; the boundary must not intersect itself.",
"Çizim park sınırının dışında veya çok küçük.":"The boundary is outside the park or too small.",

"Koordinatlar":"Coordinates",
"Waypoint noktaları":"Waypoint points",
"📍 En yakın bekleyen":"\ud83d\udccd Nearest pending point",
"→ Sıradaki nokta":"\u2192 Next point",
"🎯 Hedefi göster":"\ud83c\udfaf Show target",
"🗺 Tüm noktalar":"\ud83d\uddfa All points",
"Sıralama":"Sort points",
"Nokta numarası":"Point number",
"Yakından uzağa (GPS)":"Nearest first (GPS)",
"En yakın noktayı seçmek için önce konumu etkinleştirin.":"Enable location to select the nearest point.",
"Bekleyen waypoint kalmadı.":"No pending waypoints remain.",
"Hedef seçerek navigasyona başlayın.":"Select a target to start navigation.",
"Hedef seçildi. Mesafe ve yön için konumu etkinleştirin.":"Target selected. Enable location for distance and direction.",
"Hedef GPS belirsizlik alanında. Noktayı sahada doğrulayın.":"Target is within GPS uncertainty. Verify the point in the field.",
"Hedefe yaklaştınız. Noktayı doğrulayıp Vardım düğmesine basın.":"You are near the target. Verify the point and press Arrived.",
"Kesikli çizgi hedefe kuş uçuşu yönü gösterir; yürüyüş rotası değildir.":"The dashed line shows the straight-line direction; it is not a walking route.",

"Waypoint yükleme hatası:":"Waypoint upload failed:",
"Waypoint listesi alınamadı:":"Could not load waypoints:",
"Nokta ara":"Find a point",
"Durum":"Status",
"Tümü":"All",
"Bekleyen":"Pending points",
"Tamamlanan":"Completed points",
"Mesafe":"Distance",
"📂 CSV ve liste yönetimi":"📂 CSV and list management",
"GPS konumu bekleniyor; hedef seçebilirsiniz.":"Waiting for GPS; you can select a target.",
"Listeden veya haritadan hedef seçin.":"Select a target from the list or map.",
"Aramaya uygun nokta yok.":"No matching points.",
/* Field measurement */
"SAHA KAYDI":"FIELD RECORD",
"Konumu aç, ağacı ölç, kaydet.":"Enable location, measure the tree, save.",
"Bir ağaç · bir kayıt":"One tree · one record",
"Çalışma projesi":"Field project",
"1 · KONUM":"1 · LOCATION",
"Saha konumu":"Field location",
"Kaydederken park içinde olduğunuz doğrulanır.":"Your location inside the park is verified when saving.",
"Konum ayrıntıları ve paylaşım":"Location details and sharing",
"Kayıt için GPS doğruluğu en fazla ±60 m olmalıdır.":"GPS accuracy must be within ±60 m to save.",
"Canlı konumumu park ekibiyle paylaş":"Share my live location with the park team",
"Geçicidir; veritabanına yazılmaz.":"Temporary; not stored in the database.",
"2 · AĞAÇ":"2 · TREE",
"Ağaç bilgileri":"Tree details",
"Nokta ID":"Point ID",
"Otomatik önerilir; gerekirse değiştirin.":"Suggested automatically; change if needed.",
"Aynı noktadaki ölçüm sırası.":"Measurement sequence at this point.",
"Ağaç grubu":"Tree group",
"Grup seçin":"Select a group",
"Ağaç türü":"Tree species",
"Önce grup seçin":"Select a group first",
"Gövde çapı":"Trunk diameter",
"Ağaç boyu":"Tree height",
"Yerden 1,30 m yüksekte ölçün.":"Measure at 1.30 m above ground.",
"Ağacın toplam yüksekliği.":"Total height of the tree.",
"Örn. 52":"E.g. 52",
"Örn. 7,2":"E.g. 7.2",
"İsteğe bağlı":"Optional",
"Ağacı ve gövdesini kadraja alın.":"Include the tree and its trunk in the frame.",
"Fotoğraf ekle":"Add photo",
"Fotoğrafı kaldır":"Remove photo",
"Çap, boy ve türü girin; karbon tahmini burada görünür.":"Enter diameter, height and species to see the carbon estimate.",
"Tahmini karbon":"Estimated carbon",
"Kayıt tamamlanamadı. Bilgileriniz formda duruyor; yeniden deneyin.":"Could not save. Your entries are still in the form; please try again.",
"Bir çalışma projesi seçin.":"Select a field project.",
"Nokta ID pozitif bir tam sayı olmalı.":"Point ID must be a positive integer.",
"Ölçüm No pozitif bir tam sayı olmalı.":"Measurement number must be a positive integer.",
"Ağaç grubunu seçin.":"Select the tree group.",
"Ağaç türünü seçin.":"Select the tree species.",
"Çap 0’dan büyük, en fazla 400 cm olmalı.":"Diameter must be greater than 0 and at most 400 cm.",
"Boy 0’dan büyük, en fazla 100 m olmalı.":"Height must be greater than 0 and at most 100 m.",

/* === üst gezinme / hero === */
"Sistem":"System","Yöntem":"Method","Veri & Harita":"Data & Map","İstatistik":"Statistics",
"Bilgi Merkezi & Kaynaklar":"Knowledge Center & Resources","Giriş / Kayıt":"Log in / Sign up",
"SAHADAN VERİTABANINA · BİLİMSEL KARBON ENVANTERİ":"FROM FIELD TO DATABASE · SCIENTIFIC CARBON INVENTORY",
"Bir ağacın tahmini karbon stoğunu":"Estimate a tree's carbon stock",
"saniyeler içinde hesaplayın.":"in seconds.",
"DendroGeo; sahadaki GPS konumunu, ağaç çapı ve boy ölçümünü, tür/grup bilgisini ve isteğe bağlı fotoğraf kalite kontrolünü tek bir veri akışında birleştirir. Ölçümden biyokütle ve karbon tahminine geçilir; onaylanan kayıtlar harita ve istatistik katmanlarında yayımlanır. Park analizinde 10 m arazi örtüsü verisi ayrı bir veri kaynağı olarak işlenir.":"DendroGeo combines field GPS position, tree diameter and height measurements, species/group information and optional photo quality control in a single data flow. Measurements become biomass and carbon estimates; approved records are published in map and statistics layers. In park analysis, 10 m land-cover data is processed as a separate data source.",
"🔬 Sistemi Keşfet":"🔬 Explore the System","🌲 Hemen Başla":"🌲 Get Started",
/* === istatistik etiketleri === */
"Toplam Kayıt":"Total Records","Ülke":"Country","Şehir":"City","Karbon (t)":"Carbon (t)",
"Onaylı Kayıt":"Approved Records","Karbon Stoğu":"Carbon Stock",
/* === 01 üç direk === */
"Sistemin Üç Temel Direği":"The Three Pillars of the System",
"Sahadan Veri":"Data from the Field",
"GPS konumu ve cihazın bildirdiği doğruluk değeriyle saha ölçümünü konumlandırır; fotoğraf eklenirse tarayıcı içi kalite kontrolü uygulanır.":"Positions each field measurement with GPS coordinates and the device-reported accuracy; if a photo is added, in-browser quality control is applied.",
"GPS doğruluğu ölçümle kaydedilir":"GPS accuracy recorded with each measurement",
"Waypoint pusula navigasyonu":"Waypoint compass navigation",
"Çevrimdışı ölçüm + senkronizasyon":"Offline measurement + synchronization",
"Fotoğraf için tarayıcı içi QA/QC":"In-browser QA/QC for photos",
"Bilimsel Hesap":"Scientific Computation",
"Belirlenen ölçüm değişkenleriyle AGB, BHB, toplam biyokütle ve karbon tahmini üretir.":"Produces AGB, BGB, total biomass and carbon estimates from the defined measurement variables.",
"Chave et al. 2014 (DBH + boy + ρ)":"Chave et al. 2014 (DBH + height + ρ)",
"AGB × 0,26 kök/gövde varsayımı":"AGB × 0.26 root/shoot assumption",
"Tür ρ değeri yoksa grup varsayılanı":"Group default when species ρ is missing",
"Hacim hesabı":"Volume computation",
"Küresel Analiz":"Global Analysis",
"Admin onaylı merkezi veritabanı; şehir, ülke ve park bazlı agregasyonlar, QGIS uyumlu dışa aktarım.":"Centrally moderated database; city, country and park-level aggregations, QGIS-compatible export.",
"Ülke/Şehir/Park karşılaştırma":"Country/City/Park comparison",
"İnteraktif karbon haritası":"Interactive carbon map",
"DGR rapor yayını · %95 GA (Monte Carlo)":"DGR report publishing · 95% CI (Monte Carlo)",
"CC BY‑NC 4.0 açık veri lisansı":"CC BY-NC 4.0 open data license",
"Rol":"Role","Yetki":"Permissions","Ziyaretçi":"Visitor",
"Yalnızca onaylanmış kayıtları, istatistikleri ve haritayı görüntüler":"Views only approved records, statistics and the map",
"Kullanıcı":"User","Proje ve ölçüm oluşturur; kendi kayıtlarını onay beklerken de görür":"Creates projects and measurements; sees own records while pending approval",
"Denetçi (Admin)":"Reviewer (Admin)","Kayıtları onaylar/reddeder, moderasyon ve toplu dışa aktarım":"Approves/rejects records, moderation and bulk export",
"Kurucu":"Founder","Tüm yetkiler + kullanıcı/rol yönetimi (değiştirilemez)":"All permissions + user/role management (immutable)",
/* === 02 üç adım === */
"Sahadan Haritaya — Üç Adımda":"From Field to Map — In Three Steps",
"Her ölçüm, saha verisinden hesaplamaya ve denetimli yayına uzanan kontrollü bir akıştan geçer. Yayınlanan küresel veri ve istatistik katmanlarına yalnızca onaylı kayıtlar dahil edilir.":"Every measurement passes through a controlled flow from field data to computation to moderated publication. Only approved records enter the published global data and statistics layers.",
"Sahada Ölç":"Measure in the Field",
"GPS konumunu alın, waypoint pusulasıyla ağaca yönelin; DBH, boy ve grup/tür bilgilerini girin.":"Get the GPS fix, navigate to the tree with the waypoint compass; enter DBH, height and group/species.",
"GPS · DBH · BOY · FOTOĞRAF":"GPS · DBH · HEIGHT · PHOTO",
"Otomatik Hesap":"Automatic Computation",
"Fotoğraf eklenirse tarayıcı içi QA/QC uygulanır. Ardından Chave et al. (2014) modeliyle AGB hesaplanır; kök biyokütlesi ve karbon, sistemde tanımlı sabit varsayımlarla türetilir.":"If a photo is added, in-browser QA/QC is applied. AGB is then computed with the Chave et al. (2014) model; root biomass and carbon are derived with the system's documented constant assumptions.",
"Küresel Yayın":"Global Publication",
"Kayıt admin onayından sonra dünya haritasında görünür. Ülke, şehir ve park agregasyonlarına dahil edilir; QGIS ve CSV olarak dışa aktarılabilir. Park ölçeğinde, Monte Carlo %95 güven aralıklı DGR bilimsel raporu olarak yayımlanabilir.":"After admin approval the record appears on the world map, joins country, city and park aggregations, and can be exported as QGIS/CSV. At park scale it can be published as a DGR scientific report with Monte Carlo 95% confidence intervals.",
"ONAY → HARİTA → EXPORT":"APPROVAL → MAP → EXPORT",
"📐 Allometrik Formüller":"📐 Allometric Equations",
"DBH = göğüs çapı (cm) · 1,30 m'den doğrudan ölçülür":"DBH = diameter at breast height (cm) · measured directly at 1.30 m",
"— sistemde kullanılan sabit kök/gövde varsayımı":"— constant root/shoot assumption used by the system",
"Tür/grup tablosunda 51 seçim kaydı bulunur; 22 kaydın doğrudan ρ değeri vardır, 29 kayıt grup varsayılanına düşer.":"The species/group table holds 51 selectable entries; 22 have a directly sourced ρ value, 29 fall back to the group default.",
"🔬 Veri Doğruluk Politikası":"🔬 Data Accuracy Policy",
"GPS doğruluğu ölçümle kaydedilir; sabit ±10 m kayıt eşiği yoktur":"GPS accuracy is recorded per measurement; there is no fixed ±10 m recording threshold",
"Fotoğraf eklenirse tarayıcı içi çok sınıflı denetim uygulanır: yeşil · kızıl/mor · sonbahar · gövde/dal · kış kadrajı + pozlama 25–245":"If a photo is added, an in-browser multi-class check runs: green · red/purple · autumn · trunk/branch · winter framing + exposure 25–245",
"DBH ≤ 400 cm, boy ≤ 100 m":"DBH ≤ 400 cm, height ≤ 100 m",
"Admin onayı zorunlu":"Admin approval is mandatory",
/* === 03 veri & harita === */
"Veri & Harita":"Data & Map",
"🟢 Onaylı noktalara dokunun → ölçüm bilgisi + varsa fotoğraf.":"🟢 Tap approved points → measurement details + photo if available.",
"Bölgesel Dağılım":"Regional Distribution",
"Kayıt":"Records","Karbon(t)":"Carbon(t)","Ort.DBH":"Avg.DBH","Ort.Yükseklik(m)":"Avg.Height(m)","Ort.Çap":"Avg.Diam",
/* === 04 istatistik === */
"DendroGeo'da şimdiye kadar yayımlanan onaylı ağaç kayıtlarının genel görünümünü burada görebilirsiniz: kaç kayıt, kaç ülke ve şehir ile toplam tahmini karbon stoğu.":"An overview of all approved tree records published on DendroGeo so far: how many records, countries and cities, and the total estimated carbon stock.",
"Bu sayılar neyi gösteriyor?":"What do these numbers show?",
"Harita ve istatistiklerde yayınlanan, DendroGeo tarafından onaylanmış saha ölçümlerinin mevcut toplamını gösterir. Değerler zaman içinde yeni ölçümler eklendikçe değişebilir. Veri seti erken aşamadadır (küçük örneklem); ülke/şehir ortalamaları bu bağlamda yorumlanmalıdır. Kayıt düzeyindeki kalite kontrol değerlendirmeleri (örneğin boy/çap oranı incelemesi 🟡) ilgili park raporlarının §7 bölümünde ayrıca yayımlanır.":"They show the current totals of DendroGeo-approved field measurements published on the map and in statistics. Values change as new measurements are added. The dataset is at an early stage (small sample); country/city averages should be read in that context. Record-level quality-control assessments (e.g. the height/diameter ratio review 🟡) are published separately in §7 of the relevant park reports.",
/* === 05 bilgi merkezi === */
"DendroGeo'yu kullanırken ihtiyaç duyacağınız ölçüm, karbon hesabı, arazi örtüsü, park analizi ve veri paylaşımı bilgilerini tek yerde bulabilirsiniz.":"Everything you need while using DendroGeo — measurement, carbon computation, land cover, park analysis and data sharing — in one place.",
"Ağaç Envanteri":"Tree Inventory",
"Saha ölçümleri, GPS, DBH, boy, tür/grup bilgisi ve veri yaşam döngüsü.":"Field measurements, GPS, DBH, height, species/group data and the data lifecycle.",
"GPS konumu":"GPS position","DBH · boy · tür":"DBH · height · species","Çevrimdışı senkronizasyon":"Offline synchronization",
"Karbon Hesaplama":"Carbon Computation",
"Allometrik biyokütle ve karbon hesabının kullanılan denklemi, varsayımları ve sınırlılıkları.":"The equation, assumptions and limitations behind the allometric biomass and carbon computation.",
"Chave et al. 2014":"Chave et al. 2014","ρ odun yoğunluğu":"ρ wood density","Varsayım şeffaflığı":"Assumption transparency",
"10 m Arazi Örtüsü":"10 m Land Cover",
"Park polygonu üzerinde 10 m kategorik raster hücreleriyle yapılan alan analizinin veri ve QA yapısı.":"Data and QA structure of the area analysis performed with 10 m categorical raster cells over the park polygon.",
"WorldCover 2021 v200":"WorldCover 2021 v200","IO LULC 2020 çapraz kontrolü":"IO LULC 2020 cross-check","Gerçek hücre kesişimi":"True cell intersection",
"Kent Parkı Analizi":"Urban Park Analysis",
"Ağaç envanteri, karbon ve arazi örtüsünü aynı park bağlamında birbirinden ayrı veri kaynaklarıyla inceleyin.":"Examine tree inventory, carbon and land cover in the same park context, as separate data sources.",
"Park polygonu":"Park polygon","Saha + raster ayrımı":"Field + raster separation","GIS görünümü":"GIS view",
"Bilimsel Yöntem":"Scientific Method",
"Alan, geometri, biyokütle, karbon ve arazi örtüsü hesaplama zincirinin dayandığı yöntem özeti.":"Summary of the methodology behind the area, geometry, biomass, carbon and land-cover computation chain.",
"Formüller":"Equations","Projeksiyon ve alan":"Projection and area","QA/QC":"QA/QC",
"Veri ve Dışa Aktarım":"Data and Export",
"Veri yaşam döngüsü, yayınlama modeli ve araştırma/GIS iş akışlarında kullanılan çıktı formatları.":"Data lifecycle, publication model and the output formats used in research/GIS workflows.",
"QGIS iş akışı":"QGIS workflow",
"Bilimsel Raporlar (DGR)":"Scientific Reports (DGR)",
"Yayımlanan park raporları: dondurulmuş içerik, SHA-256 hash, QR kalıcı bağlantı, Monte Carlo %95 güven aralığı ve geri çekme politikası.":"Published park reports: frozen content, SHA-256 hash, QR permanent link, Monte Carlo 95% confidence interval and a retraction policy.",
"Değişmez, hash'li yayın":"Immutable, hashed publication","%95 GA · Monte Carlo":"95% CI · Monte Carlo","DataCite tarzı künye":"DataCite-style metadata",
"Proje Hakkında":"About the Project",
"Projenin amacı, açık kaynak yapısı, mimarisi ve bilimsel veri yaklaşımının genel çerçevesi.":"The project's purpose, open structure, architecture and scientific data approach.",
"Açık kaynak":"Open source","Web GIS + PWA":"Web GIS + PWA","GitHub kaynakları":"GitHub resources",
/* === 06 giriş/kayıt === */
"⏳ Google girişi tamamlanıyor…":"⏳ Completing Google sign-in…",
"Google ile devam et":"Continue with Google","veya":"or",
"Giriş":"Log in","Kayıt Ol":"Sign up","Şifre Yenile":"Reset password",
"E‑posta":"E-mail","Parola":"Password","Giriş Yap":"Sign in",
"Ad Soyad":"Full name","Kurum":"Institution","Hesap Oluştur":"Create account","Sıfırlama Gönder":"Send reset link",
…13165 tokens truncated…park algıla":"No project — detect a park first",
"💾 Projeyi Güncelle":"💾 Update Project",
"💾 Kaydı Güncelle":"💾 Update Record",
"🌳 Algılanan park:":"🌳 Detected park:",
"Proje adı otomatik":"Project name is automatically",
"Park raporu: yayınla / paylaş":"Park report: publish / share",
"park adıyla":"by park name",
"ad araması":"name search",
"bulunamadı":"not found",
"eşleşti":"matched",
"elle oluşturuldu":"created manually",
"oluşturdu ve bağlandı":"created and linked",
"ölçüm yok":"no measurements",
"Her proje için ölçüm merkezi hesaplanıp OSM'de park aranıyor":"The measurement centroid is computed for each project and the park is searched in OSM",
"(1500 m → 3500 m → ad araması). Overpass nezaketi için ~2 sn arayla.":"(1500 m → 3500 m → name search), ~2 s apart for Overpass courtesy.",
"⚠ Projeler okunamadı:":"⚠ Could not read projects:",
"✓ Park bağı eksik proje yok — hepsi bir parka bağlı.":"✓ No projects missing a park link — all are linked.",
"proje OSM parkıyla eşleşecek":"project(s) will match an OSM park",
"projede OSM parkı yok (satırdaki ✍️ ile elle oluştur)":"project(s) have no OSM park (create manually with ✍️ on the row)",
"projede ölçüm yok.":"project(s) have no measurements.",
"Proje (eski ad)":"Project (old name)",
"Yeni ad":"New name",
"✓ eşleşecek":"✓ will match",
"OSM'de eşleşen park çıkmadı. Satırlardaki":"No matching OSM park appeared. Use the",
"🔀/✍️ ile düzelt.":"🔀/✍️ controls on the rows to fix.",
"→ bağlanıyor":"→ linking",
"Kimlik":"Identity",
"Park Adı":"Park Name",
"Yeniden adlandır":"Rename",
"→ birleştir…":"→ merge…",
"Bu parkı seçilene taşı":"Move this park into the selected one",
"çift?":"dup?",
"Henüz park kimliği yok — Canlı Harita → 🌳 Park Algılama ile oluştur.":"No park identities yet — create one via Live Map → 🌳 Park Detection.",
"🙈 Boş parkları gizle":"🙈 Hide empty parks",
"Yalnız sorgulanmış, projesi/kaydı olmayan parklar; temizlemek için gösterip 🗑️ kullan.":"Only queried parks without projects/records; show them and use 🗑️ to clean up.",
"Park adı (örn. Göksu Parkı):":"Park name (e.g. Göksu Parkı):",
"— proje adları yeniden kuruldu":"— project names recomposed",
"Kaynak kimlik silinemedi:":"Could not delete the source identity:",
"beklenmedik sorgu hatası:":"unexpected query error:",
"çizim hatası:":"render error:",
"kayıt çekildi":"records fetched",
"durum":"status",
"arama":"search",
"Toplam":"Total",
"Toplam:":"Total:",
"Ölçülmüş:":"Measured:",
"Boş:":"Empty:",
"Seçili:":"Selected:",
"✕ Seçimi Temizle":"✕ Clear Selection",
"Izgara ölçüm yoğunluğu":"Grid measurement density",
"Önce grid oluştur":"Create a grid first",
"Önce proje seç":"Select a project first",
"Önce hücre seçin":"Select cells first",
"Uygun hücre yok":"No suitable cells",
"⏳ Park kimlikleri yükleniyor…":"⏳ Loading park identities…",
"⚠ Parklar okunamadı:":"⚠ Could not read parks:",
"✓ Çift kimlik yok — her park tek satırda.":"✓ No duplicate identities — every park is a single row.",
"Konum izni gerekli: bu {w} yalnızca {p} içinden veri kabul eder. Tarayıcı ayarlarından konuma izin ver.":"Location permission required: this {w} accepts data only from within {p}. Allow location access in your browser settings.",
"Konum alınamadı ({e}). Açık alanda yeniden dene.":"Could not get a location fix ({e}). Try again in an open area.",
"GPS hassasiyeti ±{a} m (eşik ±{m} m). Açık alanda bekleyip yeniden dene.":"GPS accuracy ±{a} m (threshold ±{m} m). Wait in an open area and try again.",
"Konumun {p} DIŞINDA (kenara ~{d} m). Bu proje yalnızca bu parktan veri kabul eder — başka parktan giriş engellendi.":"Your location is OUTSIDE {p} (~{d} m from the edge). This project accepts data only from this park — entry from another park was blocked.",
"Konum doğrulanamadı ({r})":"Location could not be verified ({r})",
"kenar payı":"edge margin",
"proje":"project",
"ölçüm":"measurement",
"parkı":"the park",
"Cihazda konum servisi yok: yerinde doğrulama yapılamadı; sunucu çiti yine de park dışı girişi reddeder.":"No location service on this device: on-site verification could not run; the server-side geofence still rejects out-of-park entries.",
"ℹ P{p} için kayıt yok · Yeni kayıt oluşturulacak.":"ℹ No record for P{p} · a new record will be created.",
"✓ {n} waypoint yüklendi ve projeye kalıcı kaydedildi.":"✓ {n} waypoints uploaded and saved to the project permanently.",
"✅ {n} çevrimdışı ölçüm senkronize edildi!":"✅ {n} offline measurements synchronized!",
"⚠️ {n} ölçüm başarısız. Hata: {e}":"⚠️ {n} measurements failed. Error: {e}",
"Senkronizasyon hatası:":"Sync error:",
"{n} ölçüm senkron bekliyor":"{n} measurements awaiting sync",
"{n} fotoğraf · {mb} MB / {q} MB":"{n} photos · {mb} MB / {q} MB",
"✓ {n} kaydın şehri güncellendi":"✓ City re-detected for {n} records",
"✓ {n} kayıt dışa aktarıldı":"✓ {n} records exported",
"{n} kayıt onay bekliyor":"{n} records awaiting approval",
"⚠ ~{n} hücre çok yoğun.":"⚠ ~{n} cells is very dense.",
"⚠ ~{n} hücre.\nDevam?":"⚠ ~{n} cells.\nContinue?",
"✓ Grid hazır: {n} hücre":"✓ Grid ready: {n} cells",
"Hücre {id} · {n} ölçüm":"Cell {id} · {n} measurements",
"📍 Otomatik ({n})":"📍 Auto ({n})",
"📍 Seçili ({n})":"📍 Selected ({n})",
"{n} proje parkla eşleşecek ve adları yeniden kurulacak. Devam?":"{n} projects will be matched with parks and their names recomposed. Continue?",
"✓ {n} proje parkla eşleştirildi{f}":"✓ {n} projects matched with parks{f}",
" · {n} hata":" · {n} error(s)",
"\"{name}\" adıyla elle park kimliği oluşturulsun ve proje bağlansın mı?\nKonum: ölçümlerin merkezi ({la}, {lo})":"Create a manual park identity named \"{name}\" and link the project?\nLocation: measurement centroid ({la}, {lo})",
"\"{src}\" (#{sid}) → \"{dst}\" (#{did}) birleştirilsin mi?\n\n· Projeler ve ölçümler hedef parka taşınır\n· Proje adları hedef park adına göre yeniden kurulur\n· Kaynak kimlik (#{sid}) SİLİNİR — geri alınamaz\n\nKarşılaştırma artık TEK \"{dst}\" satırı gösterir.":"Merge \"{src}\" (#{sid}) → \"{dst}\" (#{did})?\n\n· Projects and measurements move to the target park\n· Project names are recomposed from the target park name\n· Source identity (#{sid}) is DELETED — cannot be undone\n\nThe comparison will show a SINGLE \"{dst}\" row.",
"✓ #{a} → #{b} birleştirildi":"✓ #{a} → #{b} merged",
"🫥 Boş parkları göster ({n})":"🫥 Show empty parks ({n})",
"✓ Planı Uygula ({n} proje)":"✓ Apply Plan ({n} projects)",
"✓ Park algılandı:":"✓ Park detected:",
"kimlik #":"identity #",
"✓ Yedek indirildi: {f} ({n} ölçüm)":"✓ Backup downloaded: {f} ({n} measurements)",
"⚠ Aynı filtreyle bir talebiniz zaten {s}. Yönetici yanıt verene kadar yeni talep oluşturulamaz.":"⚠ You already have a request with the same filter ({s}). No new request until the admin responds.",
"⏳ gerçek zamanlı katmana bağlanılıyor…":"⏳ connecting to the realtime layer…",
"⚠ Gerçek zamanlı katman etkin değil (Supabase → Dashboard → Realtime). Kart çalışmaya devam eder; canlı liste kapalı.":"⚠ The realtime layer is not available (Supabase → Dashboard → Realtime). The card keeps working; the live list is off.",
"⚠ Gerçek zamanlı katman kapalı — canlı konum gösterilemiyor (Supabase → Dashboard → Realtime).":"⚠ Realtime layer is off — live locations cannot be shown (Supabase → Dashboard → Realtime).",
"ÇOK İYİ":"EXCELLENT",
"İYİ":"GOOD",
"ORTA":"FAIR",
"ZAYIF":"WEAK",
"⏳ Konum alınıyor…":"⏳ Acquiring location…",
"Tarayıcı konum desteklemiyor.":"Browser does not support geolocation.",
"Konum alınıyor…":"Acquiring location…",
"İzin reddedildi. iPhone: Ayarlar→Safari→Konum→Kullanırken İzin Ver.":"Permission denied. iPhone: Settings→Safari→Location→While Using the App.",
"GPS başarısız: dışarıda tekrar deneyin.":"GPS failed: try again outdoors.",
"GPS hatası.":"GPS error.",
"GPS hatası:":"GPS error:",
"Konum başlatılamadı.":"Could not start location.",
"⏳ Fotoğraf denetleniyor…":"⏳ Checking photo…",
"⏳ Hesaplanıyor ve kaydediliyor…":"⏳ Computing and saving…",
"Çevrimdışı kaydedildi — internet gelince senkronize":"Saved offline — will sync when internet returns",
"Fotoğraf uygun":"Photo OK",
"Fotoğraf uygun değil":"Photo not suitable",
"Pozlama:":"Exposure:",
"⚠ Onaylı kayıtlar yüklenemedi":"⚠ Approved records could not be loaded",
"— harita bu yüzden boş. Veri silinmedi:":"— the map is empty because of this. No data was deleted:",
"Önce proje seçin.":"Select a project first.",
"Rapor alınamadı:":"Could not fetch the report:",
"Park → Proje → Kullanıcı":"Park → Project → User",
"Google girişi bu projede henüz etkin değil. Supabase → Authentication → Providers → Google → Enable ile açın; ardından bu düğme çalışır.":"Google sign-in is not enabled for this project yet. Enable it via Supabase → Authentication → Providers → Google; the button will then work.",
"Google girişi başlatılamadı:":"Could not start Google sign-in:",
"10 m COG okuyucu yüklenmedi.":"10 m COG reader is not loaded.",
"Analiz için park polygonu yok.":"No park polygon for the analysis.",
"Park alanı geçersiz.":"Park area is invalid.",
"Park polygonu ile 10 m raster hücreleri kesişmiyor.":"The park polygon does not intersect any 10 m raster cells.",
"Raster/park alanı QA başarısız:":"Raster/park area QA failed:",
"Kısmi alan zorla yeniden dağıtılmadı.":"Partial area was not force-redistributed.",
"Çapraz kaynak alınamadı.":"Cross-source could not be fetched.",
"Park polygonu veri karosunun UTM alanında geçersiz.":"The park polygon is invalid in the data tile's UTM zone.",
"Park ile 10 m veri karosu arasında piksel kesişimi yok.":"No pixel intersection between the park and the 10 m data tile.",
"Park alanı tek karoda çok büyük; güvenli 10 m COG okuma sınırını aşıyor.":"The park is too large for a single tile; it exceeds the safe 10 m COG read limit.",
"MASKELİ / NODATA":"MASKED / NODATA",
"AOI çok sayıda 10 m veri karosuna taşıyor; analiz güvenliği nedeniyle durduruldu.":"The AOI spans too many 10 m data tiles; stopped for analysis safety.",
"Park sorgusu başarısız.":"Park query failed.",
"OSM veri döndürmedi.":"OSM returned no data.",
"yüzey+su":"surface+water",
"Detaylı yüzey sorgusu başarısız:":"Detailed surface query failed:",
"✓ Detaylı → Su polygon:":"✓ Detailed → Water polygon:",
"Su çizgi:":"Water line:",
"Sert çizgi:":"Hard line:",
"Ağaç":"Tree",
"Çalı":"Shrub",
"Çayır":"Grassland",
"Tarım":"Cropland",
"Yapılı":"Built-up",
"Çıplak":"Bare",
"Taşkın vejetasyon":"Flooded vegetation",
"Yapılı alan":"Built-up area",
"Çıplak zemin":"Bare ground",
"Yeşil alan":"Green space",
"IO LULC 10 m · 2020 (çapraz doğrulama)":"IO LULC 10 m · 2020 (cross-validation)",
"Park:":"Park:",
"Hücre:":"Cell:",
"🔬 uzlaşma %":"🔬 agreement %",

"Listeyi aç/kapat":"Toggle list",
"📁 Yeni proje oluştur":"📁 Create new project",
/* === 0038: ziyaretçi sekmesi + canlı konum beyanı === */
"👁 Ziyaretçi & Canlı":"👁 Visitors & Live",
"Ziyaretçi & Canlı":"Visitors & Live",
"👁 Ziyaretçi & Canlı İzleme":"👁 Visitors & Live Monitoring",
"Bu sekme yalnız kurucuya açıktır. Ziyaretçi sayacı kimlik tutmaz (gizlilik); oturum açmış kullanıcıların veri işlemleri aşağıdadır. Konumlar, yalnız kullanıcı \"canlı konum paylaşımı\"nı açtıysa geçici olarak görünür — veritabanına yazılmaz.":"This tab is open to the founder only. The visit counter stores no identity (privacy); data actions of signed-in users are listed below. Locations appear only while a user has live location sharing turned on — ephemeral, never written to the database.",
"👁 Toplam Ziyaret":"👁 Total Visits",
"🟢 Şu An Çevrimiçi":"🟢 Online Right Now",
"Şu An — kim, ne yapıyor":"Right Now — who is doing what",
"Canlı Konum Haritası":"Live Location Map",
"Çevrimiçi ve konum izni açık kullanıcılar otomatik görünür (geçici; veritabanına yazılmaz). Üstüne gel → kimlik + ne yapıyor; satıra tıkla → haritada odaklan. Liste 10 sn'de bir kendiliğinden tazelenir.":"Online users with location permission on appear automatically (ephemeral; never written to the database). Hover → identity + activity; click a row → focus on the map. The list refreshes itself every 10 s.",
"Son Etkinlik — kim ne yaptı":"Recent Activity — who did what",
"Etkinlik yok":"No activity",
"Zaman":"Time",
"Kim":"Who",
"Ne yaptı":"What they did",
"Ayrıntı":"Detail",
"ölçüm kaydı":"measurement record",
"proje oluşturdu":"created a project",
"veri talebi":"data request",
"rapor yayını istedi":"requested a report publication",
"👥 Canlı konumumu bu parkın çalışma arkadaşlarıyla paylaş (geçici; veritabanına yazılmaz)":"👥 Share my live location with this park's collaborators (ephemeral; never written to the database)",

/* === 0038b: ziyaretçi sekmesi uyarı parçacıkları (<b> ile bölünen düğümler) === */
"Bu sekme":"This tab is",
"yalnız kurucuya":"open to the founder only",
"açıktır. Ziyaretçi sayacı kimlik tutmaz (gizlilik); oturum açmış kullanıcıların veri işlemleri aşağıdadır. Konumlar, yalnız kullanıcı \"canlı konum paylaşımı\"nı açtıysa":". The visit counter stores no identity (privacy); data actions of signed-in users are listed below. Locations appear only while a user has turned on \"live location sharing\" —",
"geçici":"temporarily",
"olarak görünür — veritabanına yazılmaz.":"and are never written to the database.",

/* === 0040 === */
"Haritada odaklan":"Focus on map",
/* === 0044: çok sınıflı fotoğraf denetimi (eski harici model soketinin YERİNİ ALDI) ===
 * 0041-0043'teki harici model soketi + yerleşik sezgisel algılayıcı ve
 * yönetim kartı KULLANICI KARARIYLA kökten kaldırıldı (ölü yönetim kartı,
 * saha sürtünmesi, tür uydurma riski). Fotoğraf denetimi artık measure.js'teki
 * kalibre piksel sınıflandırıcısı:
 * yeşil · kızıl/mor · sonbahar · gövde/dal · kış kadrajı + pozlama. */
"yeşil örtü":"green cover",
"kızıl/mor yaprak":"red/purple foliage",
"sonbahar rengi":"autumn colour",
"gövde/dal":"trunk/branch",
"kış kadrajı (dal silüeti)":"winter framing (branch silhouette)",
"bitki/dal kanıtı yeterli":"plant/branch evidence sufficient",
"Karede ağaç/dal/bitki örtüsü kanıtı bulunamadı.":"No tree, branch or vegetation evidence was found in the frame.",
"Pozlama uygun değil (çok karanlık veya patlak).":"Exposure is unsuitable (too dark or blown out).",
"Ağacı, gövdesini veya dallarını kadraja alıp yeniden çekin.":"Reframe to include the tree, its trunk or its branches, then shoot again.",
"⬆ Gizle":"⬆ Hide",
"📡 Canlı Aksiyon Akışı":"📡 Live Action Feed",
"geçici · yazılmaz":"ephemeral · not stored",
"çevrimiçi oldu":"came online",
"görüntüledi":"viewed",
"ölçüm kaydetti":"saved a measurement",
"kayıt güncelledi":"updated a record",
"park algıladı":"detected a park",
"dışa aktardı":"exported",
"oturum":"session",
"gezinti":"trail",
"son eylem":"last action",
"iz":"track",
"⬇ Göster":"⬇ Show",
"Fotoğraf denetleniyor…":"Checking photo…",
"Yalnızca görsel dosyası yükleyin.":"Upload an image file only.",

/* sayfa başlığı */
"DendroGeo — Küresel Ağaç Envanteri ve Karbon Veri Sistemi":"DendroGeo — Global Tree Inventory & Carbon Data System",

/* === 🛰 UYDU HASSASİYET PANELİ (0054 · 2026-10-03) — workbench UI kaldırıldı, basit kaydırıcı paneli === */
"UYDU HASSASİYET":"SATELLITE SENSITIVITY",
"Harita":"Map",
"{p} · {n} sahne · {c} hücre profili":"{p} · {n} scenes · {c} cell profiles",
"Güncel sezon Sentinel-2 görüntüsünden aday hücreleri bulur; kaydırıcıyla hassasiyeti ayarla, uydu altında gözünle doğrula, tek dokunuşla kabul et.":"Finds candidate cells from current-season Sentinel-2 imagery; adjust sensitivity with the slider, verify with your eyes on the satellite basemap, accept with one tap.",
"Yeniden Tara":"Re-scan",
"Tara":"Scan",
"Uydu/sokak altlığı":"Satellite/street basemap",
"Sokak":"Street",
"Uydu":"Satellite",
"DÖNEM":"PERIOD",
"Güncel sezon (en yeni görüntü)":"Current season (newest imagery)",
"WorldCover yılı (2021)":"WorldCover year (2021)",
"hassasiyet":"sensitivity",
"aday":"candidates",
"Hepsini kabul":"Accept all",
"Onaylarınla":"With your approvals",
"Adayları haritada göster":"Show candidates on map",
"Kararları sıfırla":"Reset decisions",
"Hücreye dokun: ✅ Kabul (uydu gördüğün sınıf) · ❌ Harita doğru · ↩ Geri al. Kararlar bu park için kalıcıdır; raster sonucu değişmez, düzeltme katmanı ayrıca tutulur.":"Tap a cell: ✅ Accept (the class you see in imagery) · ❌ Map is right · ↩ Undo. Decisions persist for this park; the raster result never changes — the correction layer is kept separately.",
"Uydu verisi indiriliyor…":"Downloading satellite data…",
"🛰 Güncel Sentinel-2 sahneleri seçiliyor (bulutsuz medyan + mevsimsel kalıcılık)…":"🛰 Selecting current Sentinel-2 scenes (cloud-free median + seasonal persistence)…",
"✓ Tarama bitti: {n} hücre · kaydırıcıları oynat, adaylar haritada.":"✓ Scan complete: {n} cells · move the sliders, candidates appear on the map.",
"Tarama başarısız: ":"Scan failed: ",
"Uydu kanıtı":"Satellite evidence",
"Kabul":"Accept",
"Harita doğru":"Map is right",
"Geri al":"Undo",
"{n} aday hücre '{c}' olarak kabul edilsin mi? (Yalnız görüntüyle gözle doğruladığın sınıf için kullan)":"Accept {n} candidate cells as '{c}'? (Use only for a class you visually verified in the imagery)",
"✓ {n} hücre kabul edildi ve kaydedildi.":"✓ {n} cells accepted and saved.",
"Tüm kararlar silinsin mi? (Tarama profili kalır)":"Delete all decisions? (The scan profile is kept)",
"Önce en az bir karar ver.":"Make at least one decision first.",
"✓ Onaylı hücre GeoJSON'u indirildi (denetim izli).":"✓ Approved cell GeoJSON downloaded (audit-trailed).",
"✓ Onay CSV'si indirildi.":"✓ Approvals CSV downloaded.",

/* === 0056 · MOD AYRIMI (analiz ↔ park algılama) === */
"🛰 Analiz modu: park algılama duraklatıldı — hücrelere güvenle dokunabilirsin.":"🛰 Analysis mode: park detection paused — tap cells safely.",
"🌳 Park seçim modu: haritadan bir parka tıklayabilirsin. Analize dönmek için 🛰 düğmesine bas.":"🌳 Park selection mode: click a park on the map. Press 🛰 to return to analysis.",
"Analiz modu · park algılama duraklatıldı":"Analysis mode · park detection paused",
"Park seçim modu açık":"Park selection mode on",
"Analiz moduna dön":"Return to analysis mode",
"Park seçmek için algılamayı aç":"Enable detection to pick a park",
"Analiz":"Analysis",
"Park seç":"Pick park",

/* === 0058 · Doğrulanmış Harita PNG çıktısı === */
"Doğrulanmış Harita":"Validated Map",
"Önce en az bir hücre kararı ver — doğrulanmış harita kararlarını gösterir.":"Make at least one cell decision first — the validated map shows your decisions.",
"✓ Doğrulanmış harita PNG indirildi.":"✓ Validated map PNG downloaded.",
"Önce arazi örtüsü analizini çalıştırın.":"Run the land cover analysis first.",
"PNG üretilemedi.":"Could not produce the PNG.",
};

/* EN→TR ters haritası (TR'ye dönüşte kullanılır) */
const DG_I18N_TR={};
for(const k in DG_I18N_EN){ if(!(DG_I18N_EN[k] in DG_I18N_TR)) DG_I18N_TR[DG_I18N_EN[k]]=k; }

let DG_LANG="tr";
try{ if(localStorage.getItem("dg_lang")==="en") DG_LANG="en"; }catch(e){}

const DG_I18N_SKIP="script,style,svg,textarea,.notranslate,[translate=\"no\"]";

function dgT(s){ const t=String(s==null?"":s).trim(); if(!t)return s;
 return DG_LANG==="en"?(DG_I18N_EN[t]??s):(DG_I18N_TR[t]??s); }

/* ŞABLON ÇEVİRİ (0035c): sayı/değişken gömülü dinamik dizeler tam eşleşmez.
 * dgTf("✓ {n} onaylı kayıt yüklendi", {n:44}) → TR'de aynı, EN'de sözlükteki
 * EN şablonuna aynı {var} yer tutucularıyla çevrilir. Çağıran taraf şablonu
 * BİREBİR yazmalı (sözlük anahtarı = TR şablonun kendisi). */
function dgTf(tpl,vars){
 let out=dgT(tpl);
 out=String(out);
 for(const k in vars) out=out.split("{"+k+"}").join(String(vars[k]));
 return out;
}

/* Bir alt ağacı çevir: metin düğümleri + placeholder/title/aria-label. */
function dgApplyI18n(root){
 root=root||document.body; if(!root||typeof document.createTreeWalker!=="function")return;
 if(root.closest&&root.closest(DG_I18N_SKIP))return;
 const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT);
 let n=w.currentNode=root;
 const nodes=[];
 if(root.nodeType===3)nodes.push(root);
 while((n=w.nextNode()))nodes.push(n);
 for(const nd of nodes){
  if(nd.nodeType===3){
   if(nd.parentElement&&nd.parentElement.closest(DG_I18N_SKIP))continue;
   const raw=nd.nodeValue, t=raw.trim();
   if(!t)continue;
   const dict=DG_LANG==="en"?DG_I18N_EN:DG_I18N_TR;
   const hit=dict[t];
   if(hit&&hit!==t){
    const lead=raw.slice(0,raw.indexOf(t)), tail=raw.slice(raw.indexOf(t)+t.length);
    nd.nodeValue=lead+hit+tail;
   }
  }else if(nd.nodeType===1){
   if(nd.closest&&nd.closest(DG_I18N_SKIP)&&nd!==root)continue;
   for(const at of ["placeholder","title","aria-label","data-label","alt"]){
    const v=nd.getAttribute&&nd.getAttribute(at);
    if(v){const tv=dgT(v); if(tv!==v)nd.setAttribute(at,tv);}
   }
  }
 }
}

function dgUpdateLangToggles(){
 document.querySelectorAll(".dg-lang-toggle").forEach(b=>{
  b.textContent=DG_LANG==="en"?"TR":"EN";
  b.setAttribute("aria-label",DG_LANG==="en"?"Türkçe'ye geç":"Switch to English");
 });
}

function dgSetLang(lang,skipSave){
 DG_LANG=(lang==="en")?"en":"tr";
 try{ if(!skipSave)localStorage.setItem("dg_lang",DG_LANG); }catch(e){}
 document.documentElement.lang=DG_LANG;
 dgApplyI18n(document.body);
 dgUpdateLangToggles();
 const tk=Object.keys(DG_I18N_EN).length; /* sözlük yüklü ✓ */
 const dt=DG_LANG==="en"?(DG_I18N_EN[document.title.trim()]||document.title):(DG_I18N_TR[document.title.trim()]||document.title);
 if(dt&&dt!==document.title)document.title=dt;
 try{ window.dispatchEvent(new CustomEvent("dg:lang",{detail:{lang:DG_LANG,keys:tk}})); }catch(e){}
}
function dgToggleLang(){ dgSetLang(DG_LANG==="en"?"tr":"en"); }

/* Dinamik içerik: lang!=tr iken eklenen düğümleri de çevir; TR'de geri al. */
if(typeof window!=="undefined"&&"MutationObserver" in window){
 const mo=new MutationObserver(muts=>{
  for(const m of muts){
   for(const nd of m.addedNodes){
    if(nd.nodeType===1){ if(nd.closest&&nd.closest(DG_I18N_SKIP))continue; dgApplyI18n(nd); }
    else if(nd.nodeType===3){
     if(nd.parentElement&&nd.parentElement.closest(DG_I18N_SKIP))continue;
     const raw=nd.nodeValue,t=raw.trim(); if(!t)continue;
     const dict=DG_LANG==="en"?DG_I18N_EN:DG_I18N_TR; const hit=dict[t];
     if(hit&&hit!==t){const i=raw.indexOf(t);nd.nodeValue=raw.slice(0,i)+hit+raw.slice(i+t.length);}
    }
   }
  }
 });
 const startMo=()=>{ if(document.body)mo.observe(document.body,{childList:true,subtree:true}); };
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",startMo);else startMo();
}

/* Açılış: kayıtlı dil EN ise uygula (markup TR gelir). */
(function dgI18nInit(){
 const run=()=>{ dgUpdateLangToggles(); if(DG_LANG==="en")dgSetLang("en",true); };
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",run);else run();
})();

