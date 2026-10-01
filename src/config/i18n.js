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
"— çevre→çap dönüşümü UYGULANMAZ; ham saha değeri (girth_cm) kanıt olarak saklanır":"— no girth→diameter conversion is applied; the raw field value (girth_cm) is preserved as evidence",
"— sistemde kullanılan sabit kök/gövde varsayımı":"— constant root/shoot assumption used by the system",
"Tür/grup tablosunda 50 seçim kaydı bulunur; 22 kaydın doğrudan ρ değeri vardır, 28 kayıt grup varsayılanına düşer.":"The species/group table holds 50 selectable entries; 22 have a directly sourced ρ value, 28 fall back to the group default.",
"🔬 Veri Doğruluk Politikası":"🔬 Data Accuracy Policy",
"GPS doğruluğu ölçümle kaydedilir; sabit ±10 m kayıt eşiği yoktur":"GPS accuracy is recorded per measurement; there is no fixed ±10 m recording threshold",
"Fotoğraf eklenirse bitki örtüsü ≥ %25 ve pozlama 25–245 aralığı kontrol edilir":"If a photo is added, vegetation ≥ 25% and exposure 25–245 are checked",
"DBH ≤ 400 cm, boy ≤ 100 m":"DBH ≤ 400 cm, height ≤ 100 m",
"Admin onayı zorunlu":"Admin approval is mandatory",
/* === 03 veri & harita === */
"Veri & Harita":"Data & Map",
"🟢 Onaylı noktalara dokunun → ölçüm bilgisi + varsa fotoğraf.":"🟢 Tap approved points → measurement details + photo if available.",
"Bölgesel Dağılım":"Regional Distribution",
"Kayıt":"Records","Karbon(t)":"Carbon(t)","Ort.DBH":"Avg.DBH","Ort.Yükseklik(m)":"Avg.Height(m)","Ort.Çap":"Avg.DBH",
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
"Giriş":"Log in","Kayıt":"Sign up","Şifre Yenile":"Reset password",
"E‑posta":"E-mail","Parola":"Password","Giriş Yap":"Log in",
"Ad Soyad":"Full name","Kurum":"Institution","Hesap Oluştur":"Create account","Sıfırlama Gönder":"Send reset link",
/* === footer === */
"Ağaç envanteri, karbon hesabı, harita ve park ölçeğinde arazi örtüsü analizi.":"Tree inventory, carbon computation, mapping and park-scale land-cover analysis.",
"Referanslar":"References","KVKK Aydınlatma":"KVKK Disclosure (TR)","Gizlilik Politikası":"Privacy Policy (TR)",
"Kullanım Koşulları":"Terms of Use (TR)","Künye & İletişim":"Imprint & Contact (TR)","Hakkımızda":"About",
"🔒 Bu site izleme çerezi, reklam ve üçüncü taraf analitik kullanmaz. Kod CC BY-NC 4.0 · veri DOI: 10.5281/zenodo.22948643":"🔒 This site uses no tracking cookies, ads or third-party analytics. Code CC BY-NC 4.0 · data DOI: 10.5281/zenodo.22948643",
"📚 Kaynakça":"📚 Bibliography","📝 Atıf & Lisans":"📝 Citation & License",
"Veri Lisansı:":"Data License:","CC BY-NC 4.0 — Ticari olmayan kullanımda, kaynak gösterilerek serbestçe paylaşılabilir.":"CC BY-NC 4.0 — freely shareable for non-commercial use with attribution.",
"⚖️ Politikalar":"⚖️ Policies","Veri Doğruluk Politikası":"Data Accuracy Policy",
"Üretici · Sinan ŞİRİN":"Producer · Sinan ŞİRİN",
/* === uygulama kabuğu: üst bar + menü === */
"📲 Uygulayı Kur":"📲 Install App","Çıkış":"Log out","Saha":"Field",
"📊 Panel":"📊 Dashboard","📏 Yeni Ölçüm":"📏 New Measurement","🧭 Waypoint":"🧭 Waypoint","🗺️ Canlı Harita":"🗺️ Live Map",
"Veri":"Data","📁 Projeler":"📁 Projects","📋 Kayıtlarım":"📋 My Records","💾 Dışa Aktar":"💾 Export","🌍 Dünya Verisi":"🌍 World Data",
"Yönetim":"Administration","🔐 Ölçüm Yönetimi":"🔐 Measurement Admin","👥 Kullanıcılar":"👥 Users",
/* === panel === */
"Genel Bakış":"Overview","Kişisel Analiz Paneli":"Personal Analysis Panel",
"🌱 Karbonum":"🌱 My Carbon","kg C (saf karbon)":"kg C (pure carbon)","📍 Waypoint":"📍 Waypoints","✅ Tamamlanan":"✅ Completed",
"Kişisel Ağaç Analizi":"Personal Tree Analysis","Karbon Trendi":"Carbon Trend","son 10 kayıt · kg":"last 10 records · kg",
/* === yeni ölçüm === */
"Yeni Ölçüm":"New Measurement","Düzenleme modu:":"Edit mode:","mevcut kaydı güncelliyorsunuz.":"you are updating an existing record.","Vazgeç":"Cancel",
"1 · SAHA KONUMU":"1 · FIELD POSITION","🛰 GPS / Uydu":"🛰 GPS / Satellite",
"Biyokütle ve jeodezik alan için koordinat":"Coordinates for biomass and geodesic area","konum kapalı":"location off","doğruluk (m)":"accuracy (m)",
"Konum servisi kapalı.":"Location service is off.","📡 Konumu Etkinleştir":"📡 Enable Location",
"Doğrulama eşiği ±60 m · park dışı kayıt sunucuda reddedilir (0007).":"Verification threshold ±60 m · out-of-park records are rejected server-side (0007).",
"iPhone kullanıcısı mısınız?":"iPhone user?",
"Enlem":"Latitude","Boylam":"Longitude","Rakım":"Elevation","Sinyal":"Signal",
"Proje":"Project","(park adı - etiket)":"(park name - label)","🔍 Sorgula":"🔍 Query","Ölçüm No":"Measurement No",
"Grup":"Group","Seç":"Select","Tür (Latince)":"Species (Latin)","Çap (cm)":"Diameter (cm)","Boy (m)":"Height (m)",
"📸 Fotoğraf (canlı çekim)":"📸 Photo (live capture)","💾 Hesapla ve Kaydet":"💾 Compute & Save",
/* === waypoint === */
"Waypoint Navigasyon":"Waypoint Navigation","Waypoints.csv Yükle (X,Y,id)":"Load Waypoints.csv (X,Y,id)",
"⬆ Waypoint Yükle":"⬆ Upload Waypoints","🗑 Listeyi Tamamen Sil":"🗑 Delete Entire List",
"Liste projeye kalıcı kaydedilir; tekrar yüklemeye gerek yok.":"The list is saved to the project permanently; no need to re-upload.",
"hedefe mesafe":"distance to target","🎯 Vardım → Ölçüme Geç":"🎯 Arrived → Go to Measurement",
"📍 Waypoint Listesi":"📍 Waypoint List","(üstü çizili = yapıldı)":"(strikethrough = done)",
"Durum":"Status","İşlem":"Action",
"🔴 waypoint (numaralı, tıkla=hedef) · 🟢 yapıldı · 🔵 konumun":"🔴 waypoint (numbered, click=target) · 🟢 done · 🔵 you are here",
/* === canlı harita === */
"Canlı Harita":"Live Map","🌳 Park Analizi Modu: KAPALI":"🌳 Park Analysis Mode: OFF","Harita:":"Map:",
"🗺️ Sokak":"🗺️ Street","🛰️ Uydu":"🛰️ Satellite","🏔️ Topoğrafik":"🏔️ Topographic",
"Açınca haritada bir parkın içine tıkla → sınırı otomatik algılanır.":"When on, click inside a park on the map → its boundary is detected automatically.",
"⏳ Onaylı kayıtlar yükleniyor…":"⏳ Loading approved records…","↻ İşaretçileri tazele":"↻ Refresh markers",
"Onayladığın kayıt hemen görünmüyorsa bu düğmeye bas.":"Press this button if a record you approved doesn't appear right away.",
"🟢 Noktalara dokunun → onaylı ölçüm bilgisi + varsa fotoğraf.":"🟢 Tap points → approved measurement info + photo if available.",
/* === projeler === */
"Projeler":"Projects","Proje Etiketi":"Project Label","Proje Adı (otomatik)":"Project Name (automatic)",
"+ Proje Oluştur":"+ Create Project","Park":"Park","Proje Adı":"Project Name","Tarih":"Date",
"Park Çalışma Arkadaşları":"Park Collaborators","davet · ortak ölçüm · onay sende":"invite · joint measurement · approval stays with you",
"Parkını bir çalışma arkadaşına aç: e-postasıyla davet et, hesabıyla kabul etsin; aynı parkın projelerine birlikte ölçü girin. Kimin ölçtüğü kayıt sahibinde görünür, onay ve rapor akışı değişmez.":"Open your park to a collaborator: invite by e-mail, they accept with their account; enter measurements together for the same park's projects. Who measured what stays visible on each record; approval and reporting flows are unchanged.",
"⏳ yükleniyor…":"⏳ loading…","🔄 Yenile":"🔄 Refresh","Park seçilince davetler ve ortaklar burada listelenir.":"Invitations and collaborators are listed here once a park is selected.",
/* === kayıtlarım === */
"Kayıtlarım":"My Records","Kayıtlarınız admin onayından sonra dünya verisinde yayınlanır.":"Your records are published in world data after admin approval.",
"Nokta":"Point","Tür":"Species","Çap":"DBH","Boy":"Height","Karbon":"Carbon","Foto":"Photo",
/* === dışa aktar === */
"📥 Standart CSV":"📥 Standard CSV","Tam bilimsel format (AGB/BHB/Karbon)":"Full scientific format (AGB/BGB/Carbon)",
"İndir":"Download","Görüntüle":"View","🗺 GeoJSON":"🗺 GeoJSON","QGIS / web harita katmanı":"QGIS / web map layer",
"🧾 QGIS CSV":"🧾 QGIS CSV","Fotoğraf eşleştirmeli saha formatı":"Field format with photo matching",
"Yöneticiden Veri Talep Et":"Request Data from the Admin",
"Belirli bir ülke / şehir / proje (kent parkı) için tüm onaylı veriyi yönetici tarafında hazırlanmış olarak e‑postanıza almak isterseniz talep oluşturun.":"Create a request to receive all approved data for a specific country / city / project (urban park), prepared by the admin, via e-mail.",
"Tümü":"All","Proje / Park":"Project / Park","Not":"Note","✉️ Talep Gönder":"✉️ Send Request",
"QGIS Fotoğraf Aktarım Rehberi":"QGIS Photo Transfer Guide",
/* === dünya verisi === */
"🟢 Noktalara dokunun → bilgi + fotoğraf balonu.":"🟢 Tap points → info + photo popup.",
"Park Karşılaştırma — Karbon Performansı":"Park Comparison — Carbon Performance",
"algılanan park bazında · proje adı değil":"by detected park · not project name",
"Aynı parkta çalışan herkesin verisi TEK satırda toplanır: park kimliği OSM elemanından türetilir, proje adları karşılaştırmayı bölmez.":"Everyone working in the same park is aggregated into ONE row: park identity is derived from the OSM element, project names don't split the comparison.",
"Park Raporu":"Park Report","📄 Rapor Oluştur":"📄 Generate Report",
/* === yönetim === */
"🔐 Ölçüm Yönetimi & Onay":"🔐 Measurement Admin & Approval",
"👁 Toplam Ziyaretçi":"👁 Total Visitors","👁 Bugün":"👁 Today","👁 Son 7 Gün":"👁 Last 7 Days",
"✉️ Bekleyen Talep":"✉️ Pending Requests","💽 Depolama Kullanımı":"💽 Storage Usage","Hesaplanıyor…":"Computing…",
"🧹 Yetim Dosyaları Temizle":"🧹 Clean Orphan Files","🌍 Şehirleri Yeniden Algıla":"🌍 Re-detect Cities","🌳 Parkları Geri Doldur":"🌳 Backfill Parks","💾 Tam Yedek İndir (JSON)":"💾 Full Backup (JSON)",
"Park Kimlikleri":"Park Identities","yeniden adlandır · birleştir · sil":"rename · merge · delete",
"🔄 Parkları Yükle":"🔄 Load Parks",
"Bilimsel Rapor Yayını":"Scientific Report Publishing","site içinden · DGR kimlikli · değişmez":"in-site · DGR identity · immutable",
"🛰 Arazi örtüsü bölümü (§5) dahil — önerilir":"🛰 Include land-cover section (§5) — recommended",
"⏳ Kuyruk yükleniyor…":"⏳ Loading queue…",
"Toplu Dışa Aktarım (Tüm Kullanıcılar)":"Bulk Export (All Users)",
"Onaylı":"Approved","Beklemede":"Pending","Red":"Rejected",
"📥 Filtreli CSV":"📥 Filtered CSV","🗺 Filtreli GeoJSON":"🗺 Filtered GeoJSON","🧾 QGIS Detaylı":"🧾 QGIS Detailed",
"Aktif Talepler":"Active Requests","Bekleyen:":"Pending:","Filtre":"Filter",
"Tamamlanan / Reddedilen Talepler":"Completed / Rejected Requests","Arşiv:":"Archive:","· Aç/Kapat ▼":"· Open/Close ▼","Talep":"Request","Kapanış":"Closed",
"Ölçüm Onay & Moderasyon":"Measurement Approval & Moderation",
"Park → Proje → Kullanıcı · kademeli açılır":"Park → Project → User · progressive disclosure",
"DURUM":"STATUS","Tümü (onaylı + bekleyen + red)":"All (approved + pending + rejected)",
"🔴 Onay bekleyenler":"🔴 Pending approval","✓ Onaylı":"✓ Approved","🚫 Reddedilmiş":"🚫 Rejected",
"ARAMA":"SEARCH","🔴 Bekleyenler":"🔴 Pending","Bekleyenleri aç":"Show pending",
"📄 Düz liste (tüm kayıtlar · ilk 300 satır)":"📄 Flat list (all records · first 300 rows)",
"👥 Kullanıcı Yönetimi":"👥 User Management","🔑 Yeni Parola Belirle":"🔑 Set New Password",
"Şifre sıfırlama bağlantısı doğrulandı. Yeni parolanızı belirleyin.":"Password reset link verified. Set your new password.",
"Yeni Parola":"New password","Yeni Parola (tekrar)":"New password (repeat)",
"💾 Parolayı Güncelle":"💾 Update Password","Şimdi Değil":"Not now",
"Önizleme":"Preview","✕ Kapat":"✕ Close","📥 İndir":"📥 Download",
/* === dinamik (JS şablonlarından sık geçenler) === */
"Henüz veri yok":"No data yet","🌳 Park Analizi Modu: AÇIK":"🌳 Park Analysis Mode: ON",
"Ağaç Çeşitliliği & Yapısal Analiz":"Tree Diversity & Structural Analysis","onaylı kayıt":"approved records",
"Grup Dağılımı":"Group Distribution","İbreli":"Conifer","Yapraklı":"Broadleaf","Diğer":"Other",
/* === 0035 kapsam genişletme: QGIS rehberi + yönetim kartları + kabuk başlıkları.
   BİLEREK ÇEVRİLMEYENLER: KVKK rıza metni (hukuki), kaynakça/atıf/tez künyeleri
   (akademik teamül: orijinal dilde kalır), tür grup adları (veri anahtarı),
   teknik tokenlar (POINT_ID, EPSG:4326, QGIS menü yolları). === */
"🎓 Bu proje;":"🎓 This project was carried out within the scope of",
"adlı doktora çalışması kapsamında gerçekleştirilmiştir.":"the doctoral study (Turkish) titled above.",
"Dışa Aktar":"Export",
"Etiket:":"Label:","Etkinleştir:":"Enable:",
"Fotoğrafları tek klasöre koy (örn.":"Put photos in a single folder (e.g.",
"). Dosya adları":"). File names must match","ile aynı olmalı. Map Tip:":"Map Tip:",
"Katman Özellikleri →":"Layer Properties →","→ HTML Map Tip:":"→ HTML Map Tip:",
"Yöntem A — İnternetten (önerilen):":"Method A — From the internet (recommended):",
"Yöntem B — Yerel klasör:":"Method B — Local folder:",
"Tüm veriler katman olur:":"All fields become layer attributes:",
"AGB, BHB, biyokütle, karbon sütunları öznitelik tablosuna işlenir.":"AGB, BGB, biomass and carbon columns are written to the attribute table.",
"ile bilgi balonu açılır.":"opens the info popup.",
"İnternet bağlantısı varken fotoğraflar otomatik yüklenir, yerel klasöre gerek yok.":"Photos load automatically while online; no local folder needed.",
"Kullanıcı ayrımı yapılmadan sistemdeki":"All data in the system, regardless of user,",
"tüm veri":"all data",", seçtiğiniz filtrelere göre dışa aktarılır.":"is exported according to the filters you select.",
"Aynı park iki kimlikle kayıtlıysa karşılaştırma":"If the same park is registered under two identities, the comparison",
"bölünür":"splits",
"— 🔀 ile birleştir. OSM\'de adı olmayan park \"İsimsiz Park\" gelir, ✏️ ile ad ver (proje adları otomatik yeniden kurulur).":"— merge with 🔀. Parks without a name in OSM appear as \"Unnamed Park\"; name them with ✏️ (project names are recomposed automatically).",
"Park için tez biçiminde rapor":"Thesis-style park reports are published",
"site içinden":"from within the site",
"yayınlanır: 📄 Yayınla → istek kuyruğa yazılır → yayın işi birkaç dakika içinde raporu üretir → kalıcı bağlantı, 🔗 Aç ve 📤 Paylaş burada belirir.":": 📄 Publish → the request is queued → the publish job produces the report within minutes → the permanent link, 🔗 Open and 📤 Share appear here.",
"KVKK Aydınlatma Metni":"KVKK Disclosure Text (TR)",

/* sayfa başlığı */
"DendroGeo — Küresel Ağaç Envanteri ve Karbon Veri Sistemi":"DendroGeo — Global Tree Inventory & Carbon Data System"
};

/* EN→TR ters haritası (TR'ye dönüşte kullanılır) */
const DG_I18N_TR={};
for(const k in DG_I18N_EN){ if(!(DG_I18N_EN[k] in DG_I18N_TR)) DG_I18N_TR[DG_I18N_EN[k]]=k; }

let DG_LANG="tr";
try{ if(localStorage.getItem("dg_lang")==="en") DG_LANG="en"; }catch(e){}

const DG_I18N_SKIP="script,style,svg,textarea,.notranslate,[translate=\"no\"]";

function dgT(s){ const t=String(s==null?"":s).trim(); if(!t)return s;
 return DG_LANG==="en"?(DG_I18N_EN[t]??s):(DG_I18N_TR[t]??s); }

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
   for(const at of ["placeholder","title","aria-label"]){
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
if("MutationObserver" in window){
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
