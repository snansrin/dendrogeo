# Değişiklik Günlüğü (Changelog)

Bu dosya DendroGeo'nun sürüm geçmişini tutar.
Biçim: [Keep a Changelog](https://keepachangelog.com/tr/1.1.0/) · Sürümleme: [SemVer](https://semver.org/lang/tr/)

Yeni sürüm yayımlama adımları: [`docs/surum-yayini.md`](docs/surum-yayini.md)

---

## [Yayımlanmadı]

### Düzeltildi — Yüzey incelemesinde kapalı yol çizgilerinin alan sayılması
Kapalı bir OSM `highway` çizgisi, yalnızca ilk ve son koordinatı eşleşiyor diye artık dolu poligon kabul edilmiyor. Yolun alansal yüzey olarak değerlendirilmesi için `area=yes` veya `area:highway` gerekir; açık genişliği bulunan doğrusal yollar çizgi olarak tamponlanır. Eski türetilmiş OSM sınırları yeni kuralla yeniden oluşturulur; manuel düzeltmeler ve kabul edilmiş rapor anlık görüntüleri korunur.

### Eklendi — 0058: 🖼️ DOĞRULANMIŞ HARİTA PNG — kabul/düzeltme SONRASI infografik çıktı
**Kullanıcı isteği (birebir):** "iyileştirmeden sonra böyle bir çıktıyı
alalım yine harika duruyor" (X lansman infografiğini göstererek).

**NE:** 1409597'nin kabul hattının (surface_reviews + polygon-clipping +
revizyon kilidi) ÜSTÜNE tek düğme: "🖼️ Doğrulanmış Harita" (Veri ve ayarlar
→ GeoJSON/CSV yanı). En az bir karar (hücre düzeltmesi VEYA çizilen bina/
havuz maskesi) varsa tarayıcı içi canvas infografik PNG üretir:
· hücreler `dgSensEffective` rengiyle (kabul edilmiş anlık görüntü),
  düzeltilen hücreler koyu yeşil konturlu
· çizilen maskeler yarı saydam üstte, park sınırı siyah
· sağ sütun: park sahası, karar sayısı, `dgSensAreas()`'nin ALT HÜCRE
  doğrulanmış alanları (bina/havuz ayrımı dahil)
· durum damgası: ÖNİZLEME / KABUL EDİLMİŞ v<revizyon>
· alt bant künye: WorldCover + Sentinel-2 tarihi + kaynak parmak izi
  (ilk 8 hane) + CC BY-NC 4.0

**KIRMIZI ÇİZGİ:** raster salt okunur; tüm sayılar record/areas'tan gelir;
yayın hattı ve make-report bu modülü tanımaz.

**Bekçiler:** test/lc-validate.test.mjs +4 (düğme/üretici/künye/kırmızı
çizgi/i18n). sw r67→r68. i18n +5.


### Düzeltildi — 0056: MOD AYRIMI — analiz etkinken park algılama TAMAMEN duraklatılır + tarama sonrası otomatik uydu altlığı
**Kullanıcı bildirimi (birebir):** "AYNI HALA PARK ALGILAMA YAPIYOR BEN
KABUL EDEMİYORUM Kİ GRİDLERİ ... GÜNCEL HARİTA DEDİM GELİŞMİŞ ALGILAMA
DEDİM ... DAHA PARK ALGILAMA İLE ANALİZİ AYIRAMIYOSUN"

**KÖK NEDEN (0055 neden yetmedi):** stopPropagation yalnız ADAY
poligonlarının tıklamasını koruyordu; oysa kullanıcının bastığı yeşil
gridler LULC rapor poligonlarıydı (dgLcRenderObjects, interactive:false) —
üstlerine tıklama DOĞRUDAN haritaya düşer, PARK_MODE açıksa dgDetectAt
çalışır, drawPark paneli söker. Olay yamasıyla çözülemez: modların
AYRIŞMASI gerekir.

**ÇÖZÜM — bekçi bayrağı (yapısal):**
* Panel mount olduğu anda `window._dgSensGuard=true`; bindParkClick ilk
  satırda guard'a bakıp ÇIKAR → panel etkinken haritanın NERESİNE
  tıklanırsa tıklansın park algılama çalışmaz (LULC gridi, boş alan, aday).
* Başlıkta mod çipi + iki düğme: 🛰 Analiz (guard açık, varsayılan) ·
  🌳 Park seç (guard'ı kullanıcı iradesiyle düşürür + PARK_MODE kapalıysa
  açar). cleanup/park değişimi guard'ı otomatik kapatır.
* TARAMA BİTİNCE altlık OTOMATİK uyduya geçer ("gözümle görüp takip
  edeyim" + "güncel harita dedim"): switchBaseLayer('sat'), durum
  DG_SENS.base'de izlenir, 🗺 Sokak düğmesiyle geri dönülür.

**Kırmızı çizgiler:** bindParkClick'in dgDetectAt yolu DEĞİŞMEDİ (yalnız
guard erken-çıkışı eklendi); "konumumdan algıla" ve geri doldurma aracı
guard'dan etkilenmez (onlar map click'i kullanmıyor). Park kimliği akışı,
motor, şema aynen.

**Bekçiler:** test/lc-validate.test.mjs +3 (guard zinciri: panel↔sens↔
cleanup, otomatik uydu altlığı, chip CSS). sw r65→r66. npm run check:
1141 test → 1141 pass / 0 fail.

### Düzeltildi — 0055: HÜCRE TIKLAMASI PARK ALGILAMAYI TETİKLİYORDU (olay kabarması)
**Kullanıcı bildirimi (birebir):** "yeşil gridleri seçerken sistem tekrardan
park algılama moduna geçiyor."

**KÖK NEDEN:** Leaflet'te interaktif vektör katmanına tıklama, DOM'da harita
kabına KABARIR (bubble). Park Analizi Modu açıksa (PARK_MODE — park
seçildikten sonra bilerek açık kalır ki başka parka tıklanabilsin)
bindParkClick aynı tıklamayı yakalayıp dgDetectAt → drawPark çalıştırıyordu:
panel sökülüyor (clearPark → DG_LC_SENS.cleanup), Overpass sorgusu atılıyor,
kullanıcının onay akışı yarıda kesiliyordu. 0053'teki workbench
poligonlarında da latent olan bu sınıf, 0054'te hücreler tıklanabilir
onay yüzeyine dönüşünce ortaya çıktı.

**ÇÖZÜM:** lc-sens polygon click handler'ı, katman olayının taşıdığı özgün
DOM olayında `L.DomEvent.stopPropagation` çağırır — popup açılır, harita
tıklaması YANMAZ. Leaflet'in kanonik katman/harita olay ayrımı deseni.

**Bekçi:** test/lc-validate.test.mjs — "0055 regresyon: hücre tıklaması
haritaya KABARMAZ" (handler desenini statik kilitler). sw r64→r65
(precache içeriği: lc-sens.js).

### Değiştirildi/Sadeleştirildi — 0054: 🛰 UYDU HASSASİYET PANELİ (workbench UI kaldırıldı · kaydırıcı + gözle onay + kalıcı kayıt)
**Kullanıcı geri bildirimi (birebir):** "yaptıkların çok teferruatlı, benim
istediğim daha basit: yüzey analizi butonuna basınca barlar çıkıyor ya —
bunlar gibi yatay bar koy; kaydırdığımda mesela sert zemin hassasiyeti
artsın ve harita üzerinde sert zeminleri işaretlesin, gözümle görüp takip
edeyim; doğru noktaları kabul ettiğimde kaydedip öylece kalsın. Daha
gelişmiş algılama, daha hassas ve GÜNCEL uydu verisi kullanarak. Az önce
yaptığını sil bence çok karışık olmuş — daha basit daha işlevsel olsun."

**KALDIRILDI:** 0053'ün üç adımlı Çalışma Sahası arayüzü
(ui/lc-workbench.js: A/B/C sekmeleri, örneklem turu, hata matrisi karnesi,
bottom-sheet etiketleme). Bilim çekirdeği (lc-validate.js metrik/örnekleme
fonksiyonları + lc-s2.js spektral motor) KORUNDU — testler duruyor,
kütüphane olarak hazır; yalnız KARMAŞIK UI gitti.

**EKLENDİ — ui/lc-sens.js (tek panel, sekmesiz):**
* Yüzey Örtüsü Analizi biter bitmez rapor barlarının HEMEN ALTINDA belirir
  (#lcSens kabı, park-export köprüsü otomatik mount — ayrı kart/düğme yok).
* 🔍 Tara: GÜNCEL sezon Sentinel-2 L2A (varsayılan 'latest' — kullanıcı
  isteği "en güncel uydu verisi") + aynı yılın ilkbahar/sonbahar kalıcılık
  pencereleri; profil IndexedDB'ye kaydedilir → sonraki açılışta TARAMASIZ,
  sahada çevrimdışı bile çalışır. Dönem seçici: Güncel / WorldCover 2021.
* Sınıf başına YATAY KAYDIRICI (0-100, varsayılan 50 = Göksu+park5 canlı
  kalibrasyonlu literatür tabanı, testle kilitli): eşikler taban etrafında
  doğrusal kayar (dgValThr; eğimler DG_VAL_SENS_K). Kaydırıcı yalnız
  ÖNBELLEKTEKİ profili yeniden sınıflar — ağ isteği YOK, anlık.
* Aday hücre (spektral ≠ raster, karar verilmemiş) haritada sınıf rengiyle
  kesikli kontur; onaylı hücre dolu renk; teyitli ince yeşil. Hücreye
  dokun → ✅ Kabul / ❌ Harita doğru / ↩ Geri al. Sınıf başına toplu
  "✓ Hepsini kabul" (confirm'li).
* Kararlar park başına KALICI (IndexedDB 'sens-<parkId>') + otomatik kayıt;
  "Onaylarınla" satırı düzeltilmiş ha + Δ'yı anlık gösterir
  (applyCorrections saf — raster groupAreas'e dokunmaz).
* 📥 GeoJSON (denetim izli onaylı hücreler) + 📥 CSV (kararlar + alanlar).

**BİLİMSEL DÜRÜSTLÜK (kırmızı çizgi aynen):** raster sonucu/rapor barları/
yayın hattı DEĞİŞMEZ; onaylar AYRI düzeltme katmanıdır (Olofsson harita+
saha-düzeltmesi ayrılığı). Varsayılan 50 kaydırıcısı 0053'teki kalibre
davranışı BİREBİR üretir (8 piksellik eşdeğerlik testi kilitler).

**DİĞER:** lc-s2 'latest' modda kalıcılık pencereleri de güncel yılı
kullanır; Windows yol düzeltmesi (check-csp.mjs + publish-queue.mjs:
URL.pathname → fileURLToPath — 'C:\C:\...' ENOENT kazası kökten bitti);
park paneli kart numaraları geri alındı (3·RAPOR PNG, 4·KATMANLAR);
css .dg-valw-* bloğu silindi, .dg-sens-* eklendi (animasyon YOK);
i18n += 33 anahtar; sw r63→r64 (precache: workbench çıktı, lc-sens girdi).

**Bekçiler:** test/lc-validate.test.mjs 70→79: hassasiyet eşdeğerlik +
kaydırıcı yön testleri (yeşil/su/sert/çıplak ↑↓), agreement sens geçişi,
lc-sens entegrasyon kilitleri (zincir/precache/lcSens kabı/mount köprüsü/
cleanup/ölü .dg-valw yasağı/i18n/kalıcılık sözleşmesi), kırmızı çizgi
bekçisi lc-sens'i de kapsar. npm run check: 1138 test → TÜMÜ YEŞİL.

### Eklendi — 0053: 🛰 DOĞRULAMA ÇALIŞMA SAHASI v5 (LULC accuracy assessment · Olofsson 2014 · Sentinel-2 çok zamanlı kanıt)
**Kullanıcı isteği:** "canlı haritanın analiz tarafını en gelişmiş seviyeye
çıkar; uydu görüntüsü ile sistemin işaretlediği su, sert zemin, yeşil alan
birebir uyuşana kadar geliştir; sahada telefonla çalıştığımızı unutma;
çalışan çekirdeğe zarar verme."

**MİMARİ — üç bağımsız kanıt hattı (sayısal sonuçları ÖLÇER, DEĞİŞTİRMEZ):**
* **A · Spektral (yeni `src/services/lc-s2.js`):** Planetary Computer
  Sentinel-2 L2A → bulutsuz medyan kompozit (yaz: 6 sahne ☁≤%20) +
  MEVSİMSEL KALICILIK taraması (ilkbahar 3 + sonbahar 2 sahne, yıllık MAX
  MNDWI/NDVI) → hücre bazında NDVI/MNDWI/NDBI/IBI → otomatik uzlaşma +
  uyuşmazlık kuyruğu (kırmızı kontur). SCL bulut maskesi {2,4,5,6,7};
  EPSG disipline: her bant KENDİ UTM bölgesinde indekslenir (bölge sınırı
  parklarında kayma olmaz).
* **B · Görsel/insan (yeni `src/services/lc-validate.js` +
  `src/ui/lc-workbench.js`):** Olofsson vd. (2014) tabakalı rastgele
  örnekleme (tohumlu PRNG → tekrar üretilebilir), Esri ~0.5 m altlıkta
  sıralı etiketleme turu (bottom sheet, ≥44px hedefler, tek el kullanımı,
  spektral ipucu çipleri), hata matrisi → OA±CI95, UA±CI95, PA, alan
  düzeltmeli ha±CI95, ağırlıklı kappa; kapı hükmü 🟢/🟡/🔴 (eşikler
  DG_VAL_GATE, testle kilitli). Kampanya IndexedDB + otomatik kayıt +
  CSV/JSON (şema dendrogeo-lc-validation/1, parmak izli).
* **C · Vektör/çapraz:** v4'teki OSM rafinasyonu + IO LULC uzlaşması
  karneyle birleşir (dokunulmadı).

**CANLI KALİBRASYON KANITI (yeni `scripts/val-qa.mjs`, iki parkta koşuldu):**
* Göksu (park 25): 7804/7864 hücre profillendi · yeşil uzlaşma %90.2 · su
  %67.1 — uyuşmayan 605 su hücresinin YILLIK max MNDWI p50=0.13: 2021'in
  hiçbir sahnesinde açık su değil → mevsimsel çekilen göl kıyısı (WorldCover
  80 = "yılın çoğunda su"); hücreler insan kuyruğuna düşer, sınıf
  UYDURULMAZ. Sert %38.2 (ağaç gölgeli yol karışık pikseli — beklenen fizik).
* Doğal Yaşam (park 5, 85 ha step): bahar yeşillenmesi kanıtı yeşil
  uzlaşmayı %22.5→%55 çıkardı (+2686 hücre). Kural seti bu iki koşuyla
  düzeltildi: (1) su = medyan VEYA yıllık-max kanıtı; (2) yeşil = yaz
  VEYA bahar kalıcılığı; (3) sert/çıplak = IBI (Xu 2008) + yıl-boyu
  vejetasyon yokluğu (asfalt yeşermez, toprak yeşerir). Eşikler literatür
  çapalıdır; HARİTAYA uydurulmaz (döngüsel doğrulama yasağı belgelendi).

**KIRMIZI ÇİZGİLER KORUNDU:** dgLcAnalyze/motor/katsayılar, MC_CFG,
QA_LIMITS, şema+migrations (yeni tablo YOK — kalıcılık IndexedDB),
publish kuyruğu, make-report.mjs, yayımlanmış raporlar, .dg-google.
Doğrulama katmanı DG_LC_LAST'i yalnız OKUR (test kilidi: workbench
groupAreas/DG_LC_LAST'e yazamaz).

**ENTEGRASYON:** park panelinde yeni kart "3 · ÇALIŞMA SAHASI" (PNG→4,
KATMANLAR→5); bayat "10 m LULC · 2020" rozeti motor gerçeğiyle düzeltildi
("10 m WorldCover 2021 · IO LULC çapraz" — 0044 vitrin↔kod ilkesi); köprü
park-export.js'te (dgValOpen, runLandCoverAnalysis deseni); zincir
lc-patches→lc-validate→lc-s2→lc-report→lc-workbench→facade; sw r61→r62
(precache += 3 modül, içerik sözleşmesi kilitleri güncellendi); i18n += ~90
anahtar (EN modu tam); css/park-panel.css += .dg-valw-* (animasyon YOK,
token'lar tek kaynak).

**Bekçiler:** test/lc-validate.test.mjs (70 test) — Olofsson metrikleri ELLE
hesaplanmış referanslarla (OA 0.80, SE 0.09187, κ 0.60239, PA/UA, alan
±SE birebir), örnekleme determinizmi, spektral kurallar (Göksu/park-5 canlı
ölçümleri vaka olarak kilitli), kapı eşikleri, kırmızı çizgi bekçisi, mobil
sözleşme (bottom sheet/44px/role=dialog), ölü CSS sınıfı taraması.
npm run check: 1083 test → TÜMÜ YEŞİL.

### Düzeltildi/Kaldırıldı — 0044: FOTOĞRAF KAPISI SAHAYI KİLİTLEMİYOR (çok sınıflı denetim) + 🤖 AI alt sistemi KÖKTEN SİLİNDİ
**Kullanıcı geri bildirimi:** "%25'i kırmızı yapraklı ağaçlar sağlamıyor ve
önümüz kış, fotoğrafta sadece dal olacağı için yeşil çok az — o yüzden fotoğraf
yükleyemez kullanıcılar. Ben bugün 1 fotoğraf için sahada 30 dk harcadım, 1
ağaç için. … 🤖 AI Ağaç Algılama … bunu sil, bu olmaması gereken bir şey.
… hiçbir yerde izi kalmasın. Fotoğraf kontrolünü yeni ölçüm sekmesinde fotoğraf
ekle butonuyla yapmak istiyorum, admin panelde istemiyorum. Mevcut sisteme
ağaç, dal, farklı renkli yaprak algılamayı ekle."

**KANIT — kök neden ölçüldü (canlı üretim kodu, 22 gerçek kare üzerinde):**
eski kapı YALNIZ yeşil pikseli sayıyordu (`2G-R-B>20 && G>50`, `vegR>=0.25`):

| Vaka | yeşil | eski kapı | yeni kapı |
|---|---|---|---|
| Mor/kırmızı yaprak (Prunus pissardii) | %11.9 | ⛔ KAYIT ENGELLİ | ✅ |
| Kış çıplak dal (3 kare) | %0.4–0.5 | ⛔ KAYIT ENGELLİ | ✅ |
| Sonbahar sarı/kızıl (2 kare) | %3.6–6.2 | ⛔ KAYIT ENGELLİ | ✅ |
| Gövde + şerit metre (DBH kadrajı) | %17.6 | ⛔ KAYIT ENGELLİ | ✅ |
| **Saf gökyüzü** | **%52 "yeşil"** | **✅ SAHTE POZİTİF** | ⛔ |
| Koyu ibreli / yeşil meşe (kontrol) | %85–89 | ✅ | ✅ |
| Beton duvar · lens kapağı · patlak | %0 | ⛔ | ⛔ |

Eski kapı 22 karede **%64** doğrulukta (7 gerçek ağaç fotoğrafını engelliyor,
saf gökyüzünü geçiriyordu). İKİNCİ kök neden: ExG indeksinde `G>B` koruması
yoktu → mavi-gökkuşağı bandı "yeşil" sayılıyordu (species-ai'deki koruma
measure.js'te hiç olmamış).

**(a) Çok sınıflı denetim (measure.js · `dgPhotoScan`/`dgPhotoGate`):**
piksel başına sınıflandırma — gök mavisi · bulut · yeşil örtü (`G>=B-2` gök
sızmasını, `G>=R-12` turuncu sızmasını keser) · sonbahar sarı/turuncu ·
antosiyanin kızıl/mor · kabuk/dal kahvesi — + parlaklık-modu sapmasıyla İNCE
YAPI (dal silüeti). Kapı: pozlama 25–245 VE en az bir kanıt →
`foliage≥%5` VEYA `gövde/dal≥%5` VEYA KIŞ KADRAJI (`mavi≥%25` iken
`yapı≥%2.5` veya `koyu≥%3`). Eşiklerin TAMAMI korpusla kalibre edildi;
sonuç **%100** (16 ağaç + 6 çöp), kış ve kızıl yaprak dahil. Sonuç kutusu
kullanıcıya NE gördüğünü söyler ("yeşil örtü %86 · gövde/dal %10"). Kapı
hâlâ teknik olarak var (`if(f&&!photoOk)`) ama artık BARİZ yanlış kareyi
(gök/duvar/kapak/patlak) yakalıyor, mevsimi/yaprak rengini değil.
`dgPhotoScan` SAF fonksiyon → tarayıcı olmadan test edilebilir
(test/photo-qa.test.mjs vm'de sentetik karelerle ölçer).

**(b) 🤖 AI alt sistemi KÖKTEN SİLİNDİ (kullanıcı kararı: "izi kalmasın"):**
`src/services/species-ai.js` (dosya), index.html tag'i, sw CORE_ASSETS
girdisi, shell'deki `#aiSuggest` kutusu ve 🤖 yönetim kartı (`#dgAiAdmin`),
admin.js'teki `dgAiAdminRender` çağrısı, measure.js'teki `dgAiOnPhoto`
kancası ve i18n'deki tüm AI/yönetim-kartı dizeleri (CORS/CSP talimatı
dahil) kaldırıldı. Fotoğraf denetimi TEK YERDE: Yeni Ölçüm sekmesi,
fotoğraf düğmesi (`onchange=checkPhoto`). Bekçiler TERSİNE çevrildi:
fix-0044 kilidi "hiçbir iz kalmadı"yı assert eder.

**(c) Landing iddiası kodla birebir (vitrin↔kod tutarlılığı):** eski
"bitki örtüsü ≥ %25 ve pozlama 25–245" satırı YALAN olacağı için güncellendi:
"Fotoğraf eklenirse tarayıcı içi çok sınıflı denetim uygulanır: yeşil ·
kızıl/mor · sonbahar · gövde/dal · kış kadrajı + pozlama 25–245" (+ EN).

**KIRMIZI ÇİZGİLER KORUNDU:** karbon motoru/katsayılar, MC_CFG, QA_LIMITS,
şema/migrations/RLS, yayın kuyrugu, make-report.mjs, yayımlanmış raporlar,
SPECIES_DATA değişmedi. Kapı istemci tarafı kolaylıktır; esas kalite kapısı
yönetici onayıdır (onay tablosu fotoğrafı zaten gösterir) — bilimsel doğrulama
zincirine hiçbir şey eklenmedi/çıkarılmadı.

**Bekçiler:** test/photo-qa.test.mjs (9 davranış + 7 statik kilit) ·
fix-0043 AI bölümü çıkarıldı (kaydırma kilitleri duruyor) · landing-claims
0044 kaldırma kilidi · user-publish r52.

**Sürüm:** sw r51→r52 (precache içeriği değişti: measure.js + species-ai
çıktı). `npm run check`: 1012 test → 1012 pass / 0 fail · CSP 27 origin yeşil.


### Düzeltildi/Eklendi — 0042: AKASYA listede + AI artık AĞAÇ ALGILAMA (tür tanıma değil)
**Kullanıcı geri bildirimi:** "ben tür tanıma istemedim, sadece ağacı algılasın
fotoğrafta · geçen gün türleri silmişsin, akasya yok, bugün giriş yapamadım akasyaya."

**Kanıt — tür silinmedi:** `git log -- src/config/species.js` → bot'un tek teması
0035 (yalnız GROUP_COLOR_INK sabiti). `git log --all -S '"AKASYA",'` → sonuç YOK:
"AKASYA" dropdown'da hiçbir sürümde bağımsız kayıt olmadı; olan YALANCI AKASYA
(Robinia) + 0011'in okuma-taraflı eşanlamlısıydı. Algı doğru, kayıt eksikti.

**(a) AKASYA artık seçilebilir (51. tür):** `{tr:"AKASYA",lat:"Acacia spp.",rho:null}`
→ YAPRAKLI; ρ KAYNAK BEKLİYOR (§4.3: kaynaklandırılamayan ρ uydurulmaz → grup
varsayılanı 541). Eski `"AKASYA":"YALANCI AKASYA"` eşanlamlısı KALDIRILDI (kanonik
adı gölgelerdi); Robinia "YALANCI AKASYA" olarak duruyor. DB'de "AKASYA" metinli
kayıt yok → geçmiş etkilenmez. Sayımlar: landing + methods + EN 51/22/29;
allometry CANARY'si bilinçli güncellendi (50/28 → 51/29). EN: "AKASYA":"ACACIA".

**(b) AI modu döndü: tür ÖNERİSİ kaldırıldı → AĞAÇ ALGILAMA doğrulaması.**
`dgAiUse`/ön-doldurma/DG_AI_LAST silindi (bekçi kilitler). Fotoğraf çekilince:
"🌳 Ağaç algılandı ✓ %93" ya da "⚠ AI ağaç algılayamadı — kadrajı düzeltin; yine
de devam edebilirsiniz (insan kararı)". ESNEK ayrıştırıcı (14/14 olgu): tree/is_tree/
detected/label/detections/results/bool/score · 0-1 ve 0-100 güven · "no_tree/
background/person" olumsuzları false · çözümlenemeyen yanıt null. Yönetim kartı:
etkinleştir + uç nokta + **eşik %** + **AI kapısı** (açıksa ağaç doğrulanmadan
KAYDET bloklanır — photoOk=false; yeniden çekim onarır) + test. AI HATA verirse
kapı kapatmaz (sahada ağ sorunu ölçümü engellemez). İlke: modül DB'ye dokunmaz,
karar insanda. sw r50.

### Düzeltildi/Eklendi — 0041: kaydırma zıplaması KÖKTEN bitti (window) + 🤖 AI tür tanıma soketi
**1) Zıplama (0040 neden yetmedi):** #layout `min-height`'lı → içerik uzayınca
ASIL KAYAN KONTEYNER #main değil **WINDOW** (mobilde #layout display:block).
0040 koruması #main.scrollTop okuyordu (hep 0) → restore hiç çalışmadı.
Şimdi dgScrollKeep/Restore **window.scrollY + #main.scrollTop birlikte**
yakalayıp geri koyuyor. Bonus: "kaldığın yerden devam" belleği de yalnız
#main'e bağlıydı (hiç kaydetmiyordu) → window scroll dinleyicisi eklendi
(dg_scrollw_*, 120 ms throttle), go() ikisini birden geri yüklüyor.

**2) 🤖 AI Tür Tanıma (kullanıcının eğittiği model için hazır soket):**
- Yeni modül `src/services/species-ai.js` (index tag + CORE_ASSETS + sw r49).
- Ölçüm formunda fotoğraf QA'dan geçince OTOMATİK öneri: "🤖 AI önerisi:
  KARAÇAM %87 [Kullan][Yoksay]" → Kullan: grup+tür seçilir, Latince ad ve
  canlı hesap tazelenir. **Bilimsel ilke: öneri ASLA otomatik kaydedilmez,
  kararı sahada insan verir** (AI modülü veritabanına hiç dokunmaz — testle
  kilitli).
- AI etiketi `resolveSpeciesName` ile KANONİK sözlüğe çözülür (eşanlamlı +
  Türkçe normalizasyon hazır); listede yoksa "elle seçin" denir, uydurulmaz.
- Yönetim → 🤖 AI Tür Tanıma kartı: etkinleştir + uç nokta URL + 🧪 test
  düğmesi (8×8 jpeg ile hat doğrulama, ms + sonuç). Ayar localStorage'da
  (cihaza özel; şema/migration yok).
- API sözleşmesi (esnek): POST multipart "photo" → JSON {species|label|name|
  prediction, confidence|score|prob} (0-1 veya 0-100).
- Gereksinimler: sunucuda CORS (Allow-Origin: https://dendrogeo.org) +
  URL'nin CSP connect-src'e eklenmesi (tek satır — adres gelince eklenecek).
- Mod B planlı: ONNX/TF.js ile TARAYICI İÇİ çıkarım (çevrimdışı saha) —
  lazylibs deseni hazır.

**Bekçiler:** window scroll pini (scrollY/scrollTo/dg_scrollw_) · AI soketi
(modül+index+CORE_ASSETS+kanca+kart+r49+DB'ye dokunmaz).

npm run check: 990 test → 988 pass / 0 fail / 2 skip · CSP 27 origin yeşil.


### Düzeltildi/Eklendi — 0040: kaydırma zıplaması bitti + Ziyaretçi sekmesi zenginleşti + kurucu konumu otomatik (CSP 0039 dahil TEK paket)
NOT: Bu paket 0039'u (CSP connect-src + wss) İÇERİR — 0039 ayrıca uygulanmaz.

**1) Kaydırma zıplaması (kullanıcı: "onaylarken ekran yukarı gidiyor"):**
Onay/red/senkron sonrası tablolar innerHTML ile yeniden çizilince #main
scrollTop sıfırlanıyordu. Çözüm: `dgScrollKeep/dgScrollRestore`
(constants.js) + **18 yeniden çizen fonksiyon sarmalandı** (loadAdmin,
dgTreeDraw, loadRecords, renderAnalysis, loadWaypoints, loadParkCompare
+ denied + legacy, dgPubRender, dgInvitesLoadMine, dgCollabRender/Load,
loadUsers, loadMyRequests, loadRequests, loadProjects, loadParkAdmin,
dgRenderScanCard). Sarmal adları aynı kalır (çağıranlar/testler etkilenmez);
orijinal gövde `…__scroll` olur. SEKME GEÇİŞİ istisna: go(),
DG_SCROLL_SWITCHING'i 500 ms true yapar → eski sekmenin konumu yeniye
taşınmaz, kayıtlı konum geri gelir. Kapsam denetimi: bekçi testi 11 kritik
fonksiyonun sarılı olduğunu kilitler.

**2) 👁 Ziyaretçi & Canlı zenginleştirme (kullanıcı: "anlık takip etmiyor,
yenileme butonu koy, bilgileri genişlet"):**
- 🔄 Yenile düğmesi (liste + sayaçlar + etkinlik).
- **10 sn otomatik tik** — sekme açıkken yaşlar/satırlar kendiliğinden
  tazelenir; sekmeden çıkınca tik durur (dgVisTickStop, go() kancalı).
- Zengin satır: ad + **rol rozeti** (KURUCU/DENETÇİ/KULLANICI — presence
  payload'una r alanı eklendi) + hangi sekmede + **📍 konum göstergesi** +
  "N s ago"; **satıra tıkla → harita o kullanıcıya odaklanır** (dgVisFocus).

**3) Canlı konum modeli değişti (kullanıcı kararı):**
- 👥 anahtarı ARTIK YALNIZ PARK ORTAKLARI için (metin: "bu parkın çalışma
  arkadaşlarıyla paylaş"). Ölçüm ekranındaki eski "kurucu da görür" ibaresi
  kalktı çünkü:
- **Kurucu görünümü OTOMATİK**: GPS açıksa konum, dg-presence payload'ına
  kendiliğinden girer (anahtarsız) → Ziyaretçi sekmesinin canlı haritasında
  belirir. Hukuki dayanak: konum verisi kayıt sırasında zaten onaylı +
  yönetici onay akışında saklı konumları görebiliyor; buradaki fark yalnız
  CANLILIK. Veri GEÇİCİ (presence), veritabanına YAZILMAZ — aynı kırmızı çizgi.
- Park ortak kanalı (dg-park-<id>) anahtara bağlı KALDI: ortak görmek
  istemeyen kapatır, kurucu takibi etkilenmez.

**4) 0039 (bu pakete gömülü): CSP connect-src + wss://*.supabase.co** —
Realtime WebSocket'ini bloklayan kök neden (konsol kanıtıyla); bekçi testiyle.

**Bekçiler (yeni 4 test):** sarmal zinciri (11 fonksiyon pini) · yenile+tik+
odak+rol payloadı · kurucu-otomatik/ortak-anahtarlı ayrımı · 0038 konum pini
yeni modele güncellendi.

npm run check: 988 test → 986 pass / 0 fail / 2 skip.
vm simülasyonu: EN canlı satır "Nagihan Şirin [KURUCU] · Measurement Admin 📍 ·
5 s ago" + dgScrollKeep 4242 / geçişte null ✓.


### Eklendi/Düzeltildi — 0038: "Ziyaretçi & Canlı" sekmesi (yalnız kurucu) + Realtime "connecting" takılmasının kök çözümü
Kullanici kararlari: (1) yonetim ozet kartlari ACILIR OLMAYACAK (0036'daki
dgAdminExpand geri alindi), (2) admine "Ziyaretçi" sekmesi — kim girip ne
yapti + CANLI HARITADA kim nerede — YALNIZ KURUCUYA ozel, (3) "connecting"-de
takilan presence/canli konum duzeltilecek.

**KOK NEDEN (canlı prob ile kanıtlandı):** Supabase Realtime sunucusu
SAGLIKLI (wss el sıkışması 101 + phx_join "ok" + presence "ok" — anon apikey
yeterli). Takılma istemcideydi: `sb.channel()` çağrısından ÖNCE
`await sb.auth.getSession()` bekleniyordu; getSession kilit/önbellek
nedeniyle çözülmezse kanal HİÇ kurulmuyor, durum sonsuza dek "connecting"
kalıyordu. Düzeltme: **subscribe önce, JWT arka planda** + **8 sn watchdog**
(sessizlik = takılma → kanalı düşür, 2 kez yeniden dene, sonra ⚠ durumu
GÖSTER). Aynı düzeltme park canlı-konum kanalında da (DG_PARK_CH_WATCH +
track yalnız SUBSCRIBED sonrası).

**👁 Ziyaretçi & Canlı sekmesi (v-visitors, yalnız role=owner):**
- 🟢 Şu An: çevrimiçi kullanıcılar — ad, hangi sekmede ("ne yapıyor"),
  kaç sn önce; çevrimiçi sayacı.
- 🗺️ Canlı Konum Haritası: paylaşımı AÇIK kullanıcılar renkli işaretçi
  (baş harf), hover → kimlik + sekme + son konum yaşı; tek kişide zoom,
  çok kişide fitBounds.
- 📜 Son Etkinlik: measurements/projects/data_requests/report_requests
  birleşik akış (kim · ne yaptı · ayrıntı · zaman, son 60 satır).
- 👁 ziyaret sayaçları (toplam/bugün/7 gün) — sayaç KİMLİK TUTMAZ (gizlilik
  beyanı kartta).
- Konum alanı presence payload'ına YALNIZ kullanıcı anahtarı açıksa + GPS
  varsa girer; GEÇİCİDİR, DB'ye yazılmaz. Anahtar metni dürüstleştirildi:
  "park ortaklarım VE KURUCU canlı haritada görür".
- Kapılar: menü öğesi yalnız owner'a görünür + loadVisitors() rol kontrolü
  (RLS'ten bağımsız istemci kapısı; veriler zaten admin/owner RLS'inde).

**Geri alınan:** 0036 açılır özet kartları (dgAdminExpand/admExpand/aLive
kartı/.dg-clickable) — kullanıcı "açılır pencere yapma" dedi; kartlar sade
stat hâline döndü. Bekçi testleri yeni duruma göre yeniden yazıldı
(açılır kablolama GERİ GELİRSE test kırılır).

**Bekçiler:** miVisitors owner kapısı · v-visitors/visLive/visMap/visActivity
kablolaması · subscribe-önce sıralaması (indexOf kanal < lastIndexOf
getSession) · watchdog · DG_PARK_CH_LIVE · konum alanı DG_LIVE_ON şartı ·
ui-audit menü sayısı 11 + visitors:10.

npm run check: 984 test → 982 pass / 0 fail / 2 skip. Sozluk 1053 anahtar,
EN→TR cakisma yok. Ziyaretci modulu vm simulasyonuyla dogrulandi (rol kapisi,
canli liste EN "30 s ago · New Measurement 📍", vzOnline).


### Düzeltildi — 0037: EN kapsami TAMAMLANDI (park paneli · davetler · kuyruk · grid · geofence) + Realtime sertlestirme + siralamalar
Kullanici denetimi (canli EN turu): park algilama paneli, davet/ortak karti,
yayin kuyrugu tablosu ("Geri cekildi" cevrisi sozluge hic girmemisti!),
moderasyon butonlari ve waypoint tablosu hala Turkce'ydi; "Aktif
Kullanicilar" karti bos gorunuyordu; canli konum calismiyordu.

**EN kapsami (sozluk 1027+ anahtar):**
- "Geri cekildi"→Retracted (0036'de gozu kacmisti) + kuyruk tablosunun
  TAMAMI: Alan/Yayin durumu/Yayın yok/Geri cekiliyor/Basarisiz/Vazgecildi,
  🔗 Ac/📤 Paylas/🗑 Geri cek/📄 Yayinla/Yeni surum, gunluk notlari,
  "son kontrol", "N tur · N katki" meta.
- PARK ALGILAMA PANELI bastan sona: adimlar, TEK kimlik notu, PROJE
  ETIKETI/PROJE ADI, Yeni proje olustur, elle park formu, kapi mesajlari
  (⛔ uc varyant), Park Kimlikleri ekrani (birlestir/yeniden adlandir/
  bos parklar/cift kimlik uyarilari + confirm sablonlari).
- DAVET/ORTAK karti: Park davetlerin, Kabul/Reddet/Geri al/Kaldir,
  Ortaklar(N)/Davetler(N), Kisi/Eklenme/E-posta (duz tire varyanti!),
  placeholder'lar, uzun aciklama notu.
- Moderasyon: 🚫 Reddet / ✓ Onayla / 🗑️ Tamamen Sil / ✏️ Duzenle & Guncelle,
  "Onay Bekliyor", rozet title'lari, duz liste durumu satiri.
- Waypoint: Bekliyor/✓ Yapildi/🎯 Hedef/Hedef:/popuplar/bos liste.
- Grid motoru, geofence kapilari (4 mesaj sablonu), LULC sinif adlari ve
  hata metinleri, GPS sinyali (COK IYI/IYI/ORTA/ZAYIF), foto QA sonucu,
  offline senkron sablonlari, disa aktarim/backup sablonlari, "En Yaygin
  6 Tur", alt text'leri (alt= ceviri listesine eklendi).
- "Kayit"→Sign up felaketi duzeltildi: sekme "Kayit Ol" oldu, tablo "Record".

**Siralamalar (T1 devam):** yonetim duz listesi project_id→point_id→olcum no;
agacta kullanici satirlari point sirali (Kayitlarim 0036'da duzeltilmisti).

**Realtime sertlestirme (T4/T5 "calismiyor" bildirimi):**
- setAuth: WS el sikismasina oturum JWT'si ACIKCA veriliyor (anon token
  yetersiz kalabiliyordu).
- Durum makinesi: connecting/on/error — kart ve dgMatesNote artik SESSIZ
  DEGIL: "⏳ baglaniliyor…", hata durumunda "⚠ Gercek zamanli katman etkin
  degil (Supabase → Dashboard → Realtime)" + 2 otomatik yeniden deneme.
- SUBSCRIBED aninda kendin dahil hemen cizilir (sync beklemeden).
- Canli konum anahtari tema uyumlu .dg-switch'e cevrildi.

**Bekciler:** cevrilmemis toast/confirm taramasi 5 yeni module genisletildi
(geofence/grid-engine/offline/park-query/visit-stats) + tek tirnak varyanti;
0037 pin testleri (Geri cekildi/Reddet/Park Algilama/Ortaklar/Bekliyor…),
presence setAuth/retry/durum kilidi, .dg-switch kilidi, siralama kilitleri.

Kirmizi cizgiler korundu (motor/sema/migration/RLS/rapor hatti/SPECIES_DATA).
npm run check: 983 test → 981 pass / 0 fail / 2 skip.


### Eklendi/Düzeltildi — 0036: EN dinamigi kapatildi + 5 kullanici ozelligi (2026-10-01)
Kullanici denetimi (canli, EN modu): waypoint tablosu/yayin kuyrugu hala
Turkce, tur dropdown'i EN'de BOS, "Kayit" basligi "Sign up" olmus,
"Dosya secilmedi" gorunuyor + 5 yeni gorev.

**EN duzeltmeleri:**
- KRITIK: grup <option>'larinda value YOKTU → EN modunda gorunum cevrilince
  value de degisiyor, fillSpecies("CONIFER") bos liste donduruyordu.
  value="IBRELI|YAPRAKLI|DIGER" acik yazildi + fillSpecies'e ters sozluk
  savunmasi (bayat DOM icin). Tur verisi her zaman kanonik TR yazilir.
- "Kayit" cakismasi: auth sekmesi "Kayit Ol" oldu (Sign up), tablo basligi
  "Kayit" → Record. Sozluk 777+ anahtar.
- Waypoint tablosu (Bekliyor/✓ Yapildi/🎯 Hedef), navTarget, popup;
  yayin kuyrugu (Alan/Yayin durumu/Yayinlandi/Geri cekildi/Yayin yok,
  🔗 Ac/📤 Paylas/🗑 Geri cek/📄 Yayinla/Yeni surum, gunluk notlari,
  "son kontrol", tur/katki meta) dgCf/dgTf ile sarildi.
- File input: inline gizleme (bayat CSS'te bile "Dosya secilmedi" gorunmez)
  + secilen dosya adi.
- i18n.js: typeof window guard (vm sertlesmesi).

**T1 siralama:** tur listesi alfabetik (tr lokali, SPECIES_DATA'ya dokunmadan
gorunumde); Kayitlarim = proje adi (alfabetik tr) → point_id (numerik) →
olcum no. Karisik dizilim bitti.

**T2 proje silme (yonetim agaci):** 📁 dugumunde 🗑 (yalniz admin/owner gorur;
RLS projects_delete sunucuda kesin karar: owner veya is_owner). Cascade ile
olcumler+waypointler gider; PARK KIMLIGI KALIR (karsilastirma butunlugu).
confirm + DG_LIVE_DIRTY + agac/ozet tazelenir.

**T3 yedekten yukle:** 💾 Tam Yedek'in yanina 📥 Yedekten Yukle. RLS gercegi:
istemci baskasinin satirini yazamaz ve id'ler GENERATED ALWAYS → geri yukleme
TEK kanaldan tam sadakatle: arac JSON'u dogrular, ozetler ve OVERRIDING
SYSTEM VALUE + ON CONFLICT DO NOTHING ile idempotent .sql uretir (Supabase
SQL Editor — migration'larin uygulandigi kanal). Sema/RLS/migration DEGISMEDI.
Ayrica yedek kunyesindeki bayat DOI (22646300→22948643) duzeltildi.

**T4 acilir ozet kartlari + aktif kullanicilar:** Kullanici/Kayit/Karbon/Proje
kartlari tiklanabilir → altta tablo acilir (kullanicilar + olcum sayilari;
son 100 olcum; projeler + sahip; ulke/sehir karbon kirilimi). Yeni
"🟢 Aktif Kullanilicilar — kim, ne yapiyor" karti: Supabase Realtime
PRESENCE (dg-presence kanali) — GECICI, DB'ye yazmaz (KVKK dostu), sekme
kapaninca duser; Realtime kapaliysa sessiz fallback.

**T5 ortak canli konum haritasi:** olcum gorunumunde "👥 Canli konumumu bu
parkin calisma arkadaslariyla paylas" anahtari (varsayilan acik, kullanicinin
kontrolunde). Park basina presence kanali (dg-park-<id>): ortaklar #map
uzerinde KISIYE OZEL RENKTE nokta (isim bas harfi), ustune gelince kimlik +
"son konum X sn once". 10 sn throttle; yalniz ayni parkin kanali; HICBIR
VERI DB'YE YAZILMAZ. Ortak sayaci dgMatesNote'ta.

**Bekciler (9 yeni test):** option value kilidi · fillSpecies savumasi +
alfabetik · Kayitlarim siralamasi · Kayit/Kayit Ol ayrimi · T2 dugme+confirm
+rol kapisi · T3 OVERRIDING/ON CONFLICT/DOI · T4 kablolama (admExpand/aLive/
presence/startShell+go kancalari) · T5 kanal+renk+tooltip+DB'ye yazmaz+
kablolama · kuyruk dgCf sarmalari.

Kirmizi cizgiler korundu: motor/katsayilar, MC_CFG, sema, migrations, RLS,
publish kuyrugu/workflow'lar, make-report.mjs, yayimlanmis raporlar,
SPECIES_DATA icerigi/sirasi (yalniz gorunum siralandi).

npm run check: 980 test → 978 pass / 0 fail / 2 skip.
SQL uretici vm simulasyonuyla dogrulandi (escape/OVERRIDING/idempotent).


### Düzeltildi — 0035d: EN modunda Türkçe KALMADI (dinamik katman) + kart silindi
Kullanici denetimi (canli test): EN modunda waypoint satiri, Kayitlarim
tablosu, toast'lar, confirm diyaloglari ve "Dosya secilmedi" hala Turkce'ydi.

- **Kullanici karari:** "Bilimsel Standartlar — Bir Bakista" karti (0035b'de
  Rol/Yetki tablosu yerine gelmisti) KOMPLE silindi — Bolum 01 yalniz uc direk.
- **dgTf/dgTfs sablon cevirisi:** sayi gomulu dinamik dizeler tam eslesmeyle
  cevrilemiyordu → {var} yer tutuculu sablonlar (canli harita durum satiri,
  waypoint navInfo, adminTree ozetleri, park karsilastirma satirlari,
  confirm'ler). Sozluk **698 EN anahtari**.
- **confirm() diyaloglari (12 yer):** dgCf/dgTfs ile sarildi — native diyalog
  DOM'dan gecmedigi icin observer ceviremiyordu. `confirm(` deseni korundu
  (park-identity kilidi sag).
- **Dil degisince yeniden cizim:** shell.js `dg:lang` kancasi aktif gorunumu
  tazeler (records/world ayrica; digerleri go() ile) — dil degistirmeden once
  cizilmis icerik eski dilde kalmiyordu.
- **data-label ozniteligi** ceviriliyor (mobil tablolarin kolon adlari).
- **"Dosya secilmedi":** tarayicinin kendi metni (sayfa diliyle degismez) →
  file input'lar .dg-file sarmalinda gorunmez (inline style ile CSS'e
  bagimlilasmadan), temali "Dosya sec" dugmesi + secilen dosya adi.
- **E-posta atif hayaleti:** data-requests.js mail sablonu hala
  "S. & N. (Version 1.0.0)" tasiyordu → DataCite ile birebir duzeltildi.
- **Bekci (yeni):** test/landing-claims.test.mjs → "uygulamada cevrilmemis
  Turkce toast/confirm KALMADI" (18 modulu tarar; ham/trim'li sozluk kontrolu;
  dgTfs sablonlari; confirm sarmasi) + dg:lang kanca kilidi + mail atfi kilidi.
  Bugun 0 kalan; gelecekte eklenen her Turkce dize CI kirmiziya dusurur.

Bilerek TR: KVKK riza metni, kaynakca/atif/tez, DB veri degerleri (tur/park/
yer adlari value olarak TR kalir — yalniz GORUNUM cevrilir), yonetici mail
govdesi (yonetici yazismasi), disa aktarim CSV basliklari (bilimsel format).

npm run check: 971 test → 969 pass / 0 fail / 2 skip.


### Düzeltildi — 0035c: kullanici geri bildirimi (standart karti silindi · EN modunda Turkce kalmadi)
Kullanici denetimi: (1) "Bilimsel Standartlar" karti istenmiyor → SILINDI;
(2) EN modunda hala Turkce gorunen ekranlar listelendi → tamami kapatildi.

- **Kart kaldirildi:** 0035b'de Rol/Yetki tablosu yerine gelen "🔬 Bilimsel
  Standartlar — Bir Bakista" karti + .stdchip CSS'i + sozluk girdileri
  kullanici karariyla komple silindi (Bolum 01 yalniz uc direk kartlari).
- **dgTf sablon cevirisi (i18n.js):** sayi/degisken gomulu dinamik dizeler
  tam eslesmeyle cevrilemiyordu → "{var}" yer tutuculu sablon fonksiyonu
  eklendi; sozluk 457 EN anahtarina cikti.
- **Kod sarmalari:** map.js (canli harita durum satiri + waypoint navInfo),
  world.js (park karsilastirma satirlari, park rapor onizleme alerti,
  Ibreli/Yaprakli yuzde satiri, pvTitle), admin-tree.js (4 ozet/meta satiri),
  park-registry.js (bos park notu) → dgT/dgTf; yardimcilar dosya-bazinda
  benzersiz (_tw/_ta — vm paylasimli baglaminda _t cakismasi yasandi, bekci
  testi eklendi).
- **Dosya inputlari:** "Dosya secilmedi" metni TARAYICI diline bagli, sayfa
  diliyle degismiyordu → .dg-file sarmali (temali .btn ailesi, input gorunmez,
  "Dosya sec" + secilen dosya adi); mPhoto ve nCsv donusturuldu
  (checkPhoto/dgFileName adlari gosterir; id'ler ve akis AYNI).
- **Sozluk genisletme (kullanicinin yapistirdigi ekranlarin TAMAMI):** park
  kapisi (⛔ Park algilanmadi...), park degistir, paylasilan parklar notu,
  ortak/yalniz olcum girisi rozetleri, Taleplerim/Tamamlandi/Isleme Alindi/
  Reddedildi, 🏆 En Iyi, Tumunu ac/kapat, Latince/Adet/Karbon (kg)/Ort. Cap/
  Ort. Boy, park kimlikleri yardim metni (🔀/✏️/🗑️), iPhone konum ipucu,
  QGIS rehberi parcalari, tum placeholder/title'lar (orn: 52, orn: 7,2,
  🔍 Ara..., park proje kullanici tur nokta...), Senkron bekleyen olcumler.
- **Bilerek TR kalanlar (belgelendi):** KVKK acik riza metni (hukuki),
  kaynakca/atif/tez kunyeleri (akademik teamul), tur adlarinin DB degerleri
  (value kanonik TR — yalniz GORUNEN metin cevrilir), park/yer adlari (veri).
- **Bekci:** landing-claims.test.mjs += dgTf sozlesmesi + sahipsiz _t(
  regresyon kilidi + yeni cekirdek ceviri kilitleri.

npm run check: 968 test → 966 pass / 0 fail / 2 skip.


### Eklendi/Düzeltildi — 0035: dis denetim paketi + tam EN/TR dil katmani (2026-10-01)
Dis denetim raporu (b82cb7e tabanli) + kullanici kararlari (P0+P1+P2+bekciler
HEPSI · DBH siniri 400 · hero bandi kalkar §04 kalir · premium-landing-motion
dali silinecek). 0034'un uzerine insa eder.

**A · i18n (kullanici istegi #1):**
- `src/config/i18n.js`: sozluk tabanli calisma-zamani cevirmen (~200 dize EN).
  Markup TR kalir (SEO/JSON-LD/testler korunur); metin dugumu + placeholder/
  title/aria-label cevirisi; MutationObserver dinamik gorunumleri yakalar;
  localStorage `dg_lang`; `<html lang>`; `dg:lang` olayi.
- Dil dugmesi landing topnav + uygulama ust bari: **EN'e bas → site+app
  Ingilizce, dugme TR olur** (dgToggleLang). KVKK riza metni BILEREK TR kalir
  (hukuki metin); tur adlari veri anahtari, cevrilmez.
- Kayit zinciri: head.html defer tag + sw.js CORE_ASSETS + r47→r48.

**B · P0 bilimsel dogruluk:**
- "DBH = Cevre ÷ π" landing'den SILINDI (0031 kirmizi cizgisi; rapor
  bekçileri landing'i taramiyordu) → "DBH = gogus capi (cm) · 1,30 m'den
  dogrudan" + "cevre→cap donusumu UYGULANMAZ; ham deger (girth_cm) kanit
  olarak saklanir" notu. Bekci: landing-claims.test.mjs (tum yayin sayfalari).
- DBH ust siniri TEK standart: **400 cm** (measure.js d>500→d>400 + landing
  QA karti + rapor QA_LIMITS zaten 400) — ucunun esitligi testle kilitli.
- Atif DataCite kaydiyla birebir: Turkce baslik + **[Software]** + v3.0.0
  (release.test kilidi guncellendi). JSON-LD: softwareVersion 3.0.0,
  sameAs'ten v1.0.0 DOI (cc-by-4.0 celiskisi) cikti, copyrightHolder 2 Person.
- Hero cipleri bekci altinda: C degeri motorla yeniden uretiliyor + h/D
  QA bandinda (15-120) zorunlu.

**C · P1 standart/erisilebilirlik:**
- Token TEK kaynak: --f-disp/--f-ui/--f-mono style.css'e tasindi;
  ui-standard.css :root duplikasyonu KALDIRILDI (0034 kaskad dersinin kalici
  cozumu); 26 elle font stack → var(--f-*); Google Fonts'tan kullanilmayan
  500 agirliklari dustu, mono 700 eklendi (.step .num kullaniyor).
- GROUP_COLOR_INK (metin tonlari): dash.js etiketleri 3.03/2.37:1 → ≥5.0:1.
  #68766e kalintilari (dash.js chart ticks, map.js popup) → #5f6d65.
- Klavye: sol menu 10 div → role="button" tabindex="0" + dgKeyActivate
  (Enter/Space); landing ulke/sehir satirlari tabindex+keydown.
- 14 form alanina label for / aria-label; 65 <th> → scope="col"
  (partials + alt sayfalar + src sablonlari; make-report.mjs DOKUNULMADI —
  rapor HTML kilitleri ve dondurulmus ciktilar korunur).
- #toastWrap → role="status" aria-live="polite" (build ancasi statik yazima
  kapali oldugu icin toast.js calisma zamaninda atar).
- Mobil hamburger (erisilebilir disclosure): aria-expanded/controls, Esc,
  link basinca kapanma (0034'teki kaydirma seridi yerine).
- hreflang simetrisi korunuyor; 7 TR alt sayfa nav'ina EN linki;
  sitemap += /rapor/ + DGR-2026-0019; tek :focus-visible kurali.

**D · P2 temizlik:**
- Hero statband kaldirildi (kullanici karari: §04 Iststatistik kalir) —
  landing.js stRec* atamalari ve .statband CSS'i de gitti.
- 26 olu animasyon sinifi + 13 olu keyframes landing.css'ten silindi (~56 satir).
- Footer "Veri Dogruluk Politikasi" toast'i → /yontem/ gercek link
  (KVKK 0034'te link olmustu); meta keywords kaldirildi.
- sw.js CORE_ASSETS += /apple-touch-icon.png, +/src/config/i18n.js; r48.
- 404.html eklendi (markali, dg-page standardinda, TR+EN).
- QGIS rehberindeki kisisel C:/dendro_foto → notr D:/DendroFoto.

**E · Bekciler — test/landing-claims.test.mjs (yeni):**
cevre÷π yasagi (tum yayin sayfalari) · tur sayilari species.js'ten · hero
cipi motorla birebir + QA bandi · DBH 400 uc yerde · sameAs DOI · 2 Person ·
keywords yok · amber metin yasagi · #68766e yasagi · tek focus-visible ·
menu klavye · 14 label · th scope · aria-live · hamburger · hreflang ·
sitemap rapor · statband yok · olu sinif yok · gercek politika linkleri ·
404 + CORE_ASSETS · i18n sozluk/kayit/tespit kilidi.

**Guncellenen mevcut kilitler:** release.test (softwareVersion SURUM, atif
[Software]+Turkce baslik) · critical-fixes (--mut TEK kaynak kaskad kilidi,
GROUP_COLOR_INK) · ui-standard.test (token anayasasi style.css'e tasindi,
ui-standard :root TANIMLAYAMAZ) · park-identity (th scope desenleri).

**Kirmizi cizgiler korundu:** karbon motoru/katsayilar, MC_CFG, dbh_cm semasi,
CSV bicimi, migrations, publish kuyrugu/workflow'lar, make-report.mjs, LULC/park
analizi, yayimlanmis rapor ciktilari, .dg-google Arial.

**Kullanicida kalan:** `git push origin --delete feat/premium-landing-motion`
(P2-9 dali silme karari) · Zenodo v1.0.0 kaydinin lisansini arayuzden
duzeltme (P0-5, yalniz kayit sahibi yapabilir).


### Düzeltildi — 0034: 2026-10-01 tam denetim paketi (landing dogrulugu · WCAG kaskadi · atif/KVKK)
Bagimsiz denetim (canli site ↔ depo ↔ canli Supabase verisi; 937 test yesilken
icerik duzeyinde) asagidakileri buldu ve bu pakette giderildi:

- **K1 birim etiketi:** Panel "kg CO2 esdeger" diyordu ama `dash.js` saf karbon
  topluyor (Σ `carbon_kg`); kodda ×44/12 donusumu yok → etiket **"kg C (saf
  karbon)"** oldu (degerler degismedi).
- **K2 seffaflık notu:** landing §04 istatistik kartina "erken asama veri seti ·
  kucuk orneklem · kayit duzeyi QA (🟡) park raporlarinin §7'sinde" notu
  eklendi. Veriye dokunulmadi (0013/0031 veri sahibi karari korunur).
- **K3 KVKK celiskisi:** footer toast'i "Yalnizca e-posta, ad ve kurum
  saklanir" diyordu; Aydinlatma Metni konum+fotograf islendigini soyluyor →
  yaniltici toast kaldirildi, `/aydinlatma/` baglantisi verildi.
- **K4 atif:** footer "(Version 1.0.0)" + v3.0.0 DOI + ters yazar sirasi
  tasiyordu → "SIRIN, N. & SIRIN, S. … (Version 3.0.0)"; `release.test.mjs`'e
  atif kilidi eklendi.
- **K5 yontem dokumani:** `docs/methods.md` §4.2 "guven araligi vermez"
  diyordu; DGR raporlari `mc.mjs` ile Monte Carlo %95 GA uretiyor (0019'da
  yayinda) → MC modeli (N=1000, seed, D±0,5 cm, H±0,25 m, korelasyonlu
  CV=0,22) belgelendi; karbon-hesaplama sayfasi hizalandi.
- **O1:** landing tur sayilari bayatti (45/17) → **50/22/28** (0011e'nin 5
  kaynakli Goksu turu; methods.md duzeltilmisti, landing unutulmustu).
- **O2 WCAG kaskad regresyonu:** en son yuklenen `ui-standard.css`
  `:root --mut:#68766e` (4.41:1) ile style.css'in 27.09 duzeltmesini
  (#5f6d65, 5.03:1) sessizce geri aliyordu → token esitlendi,
  `critical-fixes.test.mjs`'e **kaskad kilidi** eklendi.
- **O3:** kucuk amber metinler (`.hero .kick`, `.step .sub`, `.dg-kicker`,
  `.dg-page .tag` → 3.03:1) `var(--amber-ink)` oldu (5.78:1) + test kilidi.
- **O4:** TR landing DGR rapor sistemini hic anlatmiyordu (grep: 0 gecis;
  EN'de var) → Bilgi Merkezi'ne 8. kart "📄 Bilimsel Raporlar (DGR)" →
  `/rapor/`; 3. direge ve §02 3. adima %95 GA'li DGR cumlesi eklendi.
- **O5:** index'e `hreflang` (tr/en/x-default) + topnav'a EN baglantisi
  (DENETIM-2026-09-29 oneri #1).
- **O6:** admin rapor karti "(§4)" → "(§5)" (rapor v2'de LULC sonuclari §5
  Nicel Sonuclar'da; kullanici karti zaten §5 diyordu).
- **O7:** 13 alt sayfa ui-standard fontlarini referansliyor ama Google
  Fonts'u yuklemiyordu (Georgia/system-ui fallback) → index'le ayni
  render-blokamayan desen eklendi.
- **O8:** 7 TR alt sayfada bayat `?v=98461801` kaldirildi (B3 duzeltmesi
  yalniz en/'e uygulanmisti).
- **M1:** `html{scroll-padding-top:72px}` — mobilde sticky nav bolum
  basliklarini yutuyordu.
- **M2:** mobil landing nav'i `display:none` idi → ikinci satira sarar +
  yatay kayar (JS'siz).
- **M3:** footer statik "CEVRIMICI" → "CC BY-NC 4.0" (yanlis durum iddiasi yok).
- **M4:** "Hemen Basla" → `showAuth('reg')` (ilk ziyaretciye Kayit sekmesi).
- **M7:** README "506 test" → 937; kunye "sema 0001→0006" → 0001→0025;
  JSON-LD `dateModified` + sitemap `lastmod` tazelendi.
- **M9:** hero cipleri DBH 68/H 8,3 (h/D≈12 — K2'deki ayni oran sorusu) →
  **DBH 45 / H 13 / C 373,7 kg** (h/D=29; ρ=0,446 ile formulden birebir).


### Düzeltildi — 0033 kapsam düzeltmesi: rapor hiçbir yasal statü hükmü üretmez (DGR-2026-0018) (2026-10-01)
**Kök neden (veri sahibi kararı):** “Anıt ağaç detayı bizim işimiz için risk
oluşturabilir; anıt ağaç sertifikası bulunmayan ağaçları ölçmüş olabiliriz —
bunu raporda işleme alma. Ama girdiğimiz veriler **gerçek ve doğru**.
Standartları buna göre güncelle.” 0032, gövde çapı ≥ 100 cm olan bireyleri
**eşik tabanlı bir sınıfa** ayırıp raporda “Anıtsal gövde beyanı” (ℹ️) satırı,
mevzuat künyesi ve `metadata.json → monumental` alanıyla yayımlıyordu.
DendroGeo bir **ölçüm ve karbon muhasebesi** aracıdır; ağaçların yasal statüsü
bu aracın konusu değildir ve envanterde **tescilli olmayan** bireyler
bulunabileceği için rapor bir tespit/tescil iddiası **taşıyamaz**. Bu yüzden
söz konusu çerçeve **tamamen kaldırıldı**. Verinin kendisi değişmedi: gövde
çapları sahada ölçüldüğü gibi modellenir; düzeltme, ölçekleme, dışlama veya
çevre→çap dönüşümü **yoktur**. **Karbon motoru, katsayılar, MC
yapılandırması, `dbh_cm` kolonu, CSV biçimi, veri tabanı şeması, migrationlar,
yayın kuyruğu/workflowlar, `index.html`, `sw.js`, LULC ve park analizi
DEĞİŞMEDİ**; yayımlanmış `rapor/` çıktılarına dokunulmadı. Aynı veri + aynı
formül aynı sayıları üretir (kanıt: yayındaki DGR-2026-0018 snapshotı 0033
koduyla yeniden üretildi → **52,29 t**, %95 GA **28,80–73,91 t**, **1043,52
kg/ha**, n=34, rozet ve envanter QA hükmü aynı).

* **Kaldırıldı (rapor):** §7 Çizelge 4teki “Anıtsal gövde beyanı” (ℹ️) satırı,
  §7 girişindeki sınıf beyanı cümlesi, §5.1 “Gövde ölçeği notu”, §9 “Anıtsal
  gövde ölçeği” sınırlılık maddesi ve mevzuat künyesi (karar no, Resmî Gazete
  sayısı, basamak tablosu, puanlama ve yetki ifadeleri). Çizelge 4 artık **16**
  kontrol satırı basar; ağaç değerlerine ilişkin üç kontrol (DBH birim,
  boy/çap, karbon yeniden hesabı) ✓ Geçerli kalır.
* **Kaldırıldı (kod/metadata):** `QA_LIMITS.ANIT_DBH_CM`, `ANIT_MEVZUAT`,
  `ANIT_GOVDE_BASAMAKLARI`, `anitGovdeBasamagi()`; `inventoryQa` çıktısındaki
  `anit` bloğu ile satır düzeyi `anit` / `anit_basamak` alanları;
  `metadata.json → monumental` (eşik, yüzde, basamak dağılımı ve **birey
  listesi** içeriyordu); içe aktarma aracındaki `gates.anit` kapısı ve
  “ANITSAL GÖVDE” bilgi satırı.
* **Yerine: betimleyici dağılım + tek kaynaklı kapsam beyanı.** `inventoryQa`
  artık `dbh_stats` (n, min, medyan, max) üretir — **eşik, sınıf, basamak veya
  puan yoktur**. §5.1 “Gövde çapı notu” ve §9 “Gövde çapı dağılımı ve model
  temsili” maddeleri bu aralığı sayıyla verir (Göksu: **40–200 cm**, medyan
  **86 cm**, n=34) ve sınırlılığı doğru yere yazar: sorun veride değil,
  pantropikal allometrik modelin (Chave ve ark. 2014) geniş gövdeli kent
  ağaçlarını temsil gücündedir; belirsizlik %95 güven aralığına yansır. Kapsam
  beyanı **tek kaynaktan** gelir: `scripts/lib/mc.mjs → YASAL_STATU_KAPSAM`
  (§9 maddesi + `metadata.json → scopeNote`).
* **QA v5 = QA v4 ölçütleri, statü iddiası olmadan.** (a) DBH geçerlilik
  zinciri, (b) gövde formu iki katmanlı ölçütü (fiziksel makullük `3 ≤
  100·H/D ≤ 200` + boy `1,3–100 m`; stand içi robust aykırılık `modified z >
  3,5`, yalnız `n ≥ 5`) ve (c) **iki ρ kaynaklı** karbon denetimi aynen
  korunur; tipik `15–120` bandı yalnız **sayım** (`hd_band_out`) olarak durur
  ve `hd_block` kalıcı `false`tur. Gerçek hesap hataları (10× ondalık kayması)
  yakalanmaya **devam eder**. ℹ️ işareti `qaRow` içinde yetenek olarak durur
  (CSS `.qinfo` tanımı korunur) ama 0033 şablonunda ℹ️ satırı basılmaz; §7
  girişindeki ℹ️ açıklama cümlesi de **yalnız böyle bir satır varsa** üretilir.
* **Suçlayıcı dil taraması genişletildi.** Raporda “standart dışı”,
  “olağandışı oranda”, “HATALI VERİ” gibi veri sahibinin kendi ölçümünü
  şüpheli gösteren ifadeler bulunmaz; inceleme kalemleri ağaç
  değerleriyle ilgili değilse §7 bunu açıkça yazar (0032 hükmü korunur).
* **Testler:** `test/anit-qa.test.mjs` → **`test/form-qa.test.mjs`** (47 test):
  yasaklı ifade taraması (üretilen HTML, `metadata.json`, `scripts/*`,
  `docs/*`), eşikten bağımsızlık (99 cm ile 200 cm aynı muameleyi görür;
  `info` boş, durum aynı), `dbh_stats` doğruluğu, kapsam beyanının §9 ve
  metadatada birebir yer alması, Çizelge 4 düzeni (0032) ve dokunulmazlar.
  `test/dbh-qa.test.mjs` ve `test/inventory-qa.test.mjs` yeni çıktı alanlarına
  göre güncellendi (`gates.anit` → `gates.dbh`).
* **Dokümantasyon:** `docs/methods.md` §1.5.1 (QA v5, (d) maddesinin neden
  kaldırıldığı) ve `docs/rapor-yayini.md` §6 (kapı tablosu + kapsam beyanı).
* **Yayın etkisi (operasyon):** 0032 şablonuyla yayımlanmış **DGR-2026-0018**
  bu ifadeleri içerdiği için yayın panelinden **geri çekilmeli** ve 0033
  koduyla **yeni bir rapor** yayımlanmalıdır. Yayımlanmış çıktılar
  **değiştirilmez** (immütability): düzeltme yeni raporla yapılır, DGR
  kimlikleri yeniden kullanılmaz.


### Düzeltildi — 0032 anıt ağaç ölçeği + Çizelge 4 okunurluğu (DGR-2026-0017) (2026-09-30)
**Kök neden (veri sahibi kararı):** "Girdiğim ağaç değerleri gerçek, standart
dışı olabilir ama **doğru** veriler; **anıt ağaç** onlar. Ona göre raporu
düzenle. Kontrol | Sonuç | Ayrıntı tablosunu da diğer tablolar gibi göster, bu
şekilsiz olmuş." İki ayrı kusur vardı: (1) QA v3, anıtsal gövdeli standı
**veri hatası gibi** işaretliyordu — 32/34 kayıt "olağandışı boy/çap oranı",
6/34 kayıt "bant dışı karbon"; (2) §7 Çizelge 4ün ayrıntı kolonu monospace +
`overflow-wrap:anywhere` olduğu için uzun Türkçe cümleler **kelime ortasından**
kırılıyor, sabit kolon genişliği olmadığından tablo düzensiz görünüyordu.
**Karbon motoru, katsayılar, MC yapılandırması, `dbh_cm` kolonu, CSV biçimi,
veri tabanı şeması, yayın kuyruğu/workflowlar, LULC ve park analizi
DEĞİŞMEDİ**; yayımlanmış `rapor/` çıktılarına dokunulmadı; yeni migration
YOKTUR. Aynı veri + aynı formül aynı sayıları üretir.

* **QA v4 (`inventoryQa`) · (d) Anıtsal gövde beyanı (ℹ️):** DBH ≥
  `ANIT_DBH_CM` (100 cm) olan bireyler sayılır ve İlke Kararı **Ek-4** gövde
  çapı basamaklarıyla (`<50` … `≥300`, 12 basamak) birlikte beyan edilir.
  Dayanak: *Tabiat Varlığı Olarak Belirlenecek Anıt Ağaçların Tespitine İlişkin
  İlke Kararı* (Karar No: 110), TVK Merkez Komisyonu, RG **20.07.2022/31898**
  (666 sayılı kararı yürürlükten kaldırır). **Tescil hükmü DEĞİLDİR:** ŞAD/AAD
  puanlaması yaş (artım kalemi) ve tepe çapı istediği için **uygulanmaz**
  (uydurma puan yok), yetki TVK Bölge Komisyonundadır. Mevzuatın "çevre ÷
  3,14" tanımı ile DendroGeo'nun doğrudan çap kaydı arasındaki fark raporda
  beyan edilir; **dönüşüm uygulanmaz**. ℹ️ satırı `qaStates`e `info` olarak
  girer → `qaStateOf` okumaz → 🟢/🟡/🔴 **değişmez**.
* **QA v4 · (b) gövde formu ölçütü:** sabit `15–120` bandı **yalnız sayıma**
  indirildi (`hd_band_out`, "bu bir UYARI DEĞİL, BİLGİDİR"). İnceleme ölçütü
  artık iki katmanlı: **fiziksel makullük** (`3 ≤ 100·H/D ≤ 200`, boy
  `1,3–100 m`) + **stand içi robust aykırılık** (modified z =
  `0,6745·(x − medyan)/MAD`, eşik `3,5`, yalnız `n ≥ 5`; `MAD = 0` ise ortalama
  mutlak sapmaya düşer, o da 0 ise test koşulmaz). Gerekçe sayıyla: Göksu
  `100·H/D` aralığı **5,33–16,32**, medyan 9,65, MAD 1,575 → `|z|max = 2,86`
  (eşik 3,5) → **0/34 aykırı**; sabit bant 32/34ü bayraklıyordu. Stand
  dağılımı (`hd_stats`) raporda basılır. `hd_block` kalıcı `false` (0031).
* **QA v4 · (c) iki ρ kaynağı:** beklenen karbon hem **tür düzeyi ρ** hem
  **grup varsayılanı ρ** ile hesaplanır; saklı değer herhangi biriyle ±%20
  (ve mutlak fark ≥5 kg) içindeyse satır geçerlidir, eşleşen kaynak sayıyla
  beyan edilir (`dev_rho.tur/grup/grup_farkli`, satırda `rho_src`). Gerekçe:
  saklı `carbon_kg` değerlerini üreten 0011 SQL tablosu bazı türlerde grup
  varsayılanını kullanmıştı → Göksu'da 6/34 kayıt (tümü SALKIM SÖĞÜT) sahte
  "bant dışı" çıkıyordu (tür ρ=400 ile %27–34, grup ρ=541 ile %0,0–5,1).
  Gerçek hesap hataları (P7'nin 10× ondalık kayması) **yakalanmaya devam eder**.
* **§7 Çizelge 4 sunumu:** `<table class="qa">` + `<colgroup>` (`%23 / %16 /
  %61`) → `table-layout:fixed`; ayrıntı hücresi `.qd` (orantılı/sans yazı,
  `overflow-wrap:break-word` → **kelime ortasından kırılmaz**), sonuç hücresi
  `.qst` (renkli, ekranda `nowrap`; mobil + printte normal sarma → taşma yok),
  beyan satırı `.qinfo` (mavi, ⚠ ile karışmaz), satır zeminleri dönüşümlü.
  Mobilde `.tscroll` yatay kayar (`min-width:540px`), printte üç kolon korunur
  (`8,8pt`). Uzun açıklama kolonu olan **§4.6 veri sözlüğü** ve **§10 tekrar
  üretilebilirlik** çizelgeleri de `.qd` kullanır. Kontrol kolonu
  `class="tr"` olarak kaldı (mevcut bekçiler bu işareti kilitler).
* **Rapor metni:** §7 girişi ℹ️ BEYANı tanımlar ve anıtsallığı sayıyla
  bildirir ("4/6 bireyin gövde çapı 100 cm ve üzerindedir … rapor bu değerleri
  veri hatası olarak **işaretlemez**"); inceleme kalemlerinin hiçbiri ağaç
  ölçüm değerleriyle ilgili değilse bu ayrıca yazılır. §5.1e **Gövde ölçeği
  notu** (model DEĞİŞTİRİLMEDEN çalıştırıldı), §9a **Anıtsal gövde ölçeği**
  (sınırlılık veride değil model temsilindedir) ve **Odun yoğunluğu (ρ)
  kaynağı** maddeleri eklendi. Suçlayıcı "olağandışı oranda" dili kalktı.
* **`metadata.json`:** `monumental` (eşik, n, %, en büyük çap, `diameterBins`,
  `points`, `regulation`, `isRegistrationDecision: false`, `note`),
  `carbonRecalc` (bant, `matchedSpeciesRho`/`matchedGroupRho`,
  `matchedGroupOnlyPoints`, `outOfBand`), `qaInfo` alanları eklendi;
  `measurementNote` gövde ölçeği cümlesiyle genişletildi. `variables`,
  `qaState`, `qaStateLabel`, `resultHash` desenleri değişmedi.
* **Doğrulama:** yayımlanan **DGR-2026-0017**nin `data.json`ı yeni kodla
  yeniden üretildi — `.ci` toplamı (**52,29 t [%95 GA 28,80–73,91]**), tür
  çizelgesi, arazi örtüsü sınıfları, alan dengesi, t/ha, 34/34 satır karbonu,
  `DG_DATA` ve `metadata.sampleSize` **birebir aynı**; değişen yalnız QA
  hükmü/metni ve içerik hash'i. QA: `dbh_fail 0/34` · `hd_fail 0/34`
  (bant dışı SAYIM 32/34) · `dev_fail 0/34` (13 kayıt tür ρ, 21 kayıt grup ρ
  ile eşleşti; 6 kayıt grup ρ ile birebir) · **anıtsal gövde 11/34** (en büyük
  200 cm; basamaklar `<50`:1 · `50–74`:10 · `75–99`:12 · `100–124`:5 ·
  `125–149`:4 · `150–174`:1 · `200–224`:1). Envanter kalemlerinin tümü ✓;
  kalan tek ⚠ ağaç değerleriyle ilgisiz olan **GNSS `accuracy_m` kaydı**
  (0/34) → rozet 🟡 İNCELEME ve §7 bunun ağaç ölçümleriyle ilgili olmadığını
  açıkça yazar.
* **Belgeler:** `docs/methods.md` §1.5.1 (QA v4 tablosu, iki ρ kaynağı, robust
  z, anıtsal gövde/ Ek-4 dayanağı, Çizelge 4 sunumu), `docs/rapor-yayini.md`
  §6 (kapı tablosu + ℹ️ BEYAN + sunum notu) yeniden yazıldı. Migration,
  workflow, `sw.js` precache ve yayımlanmış `rapor/` çıktıları DEĞİŞMEDİ.
* **Bekçi:** `test/anit-qa.test.mjs` (**45 test**, yeni) — eşik sabitleri,
  Ek-4 basamak sınırları (24 sınır değeri), mevzuat künyesi, robust istatistik
  çekirdeği, çift ρ kaynağı (aklama + 10× hatanın yakalanması), anıtsal
  sayım/basamak dağılımı, ℹ️ beyanın durumu değiştirmediği, Çizelge 4
  markup/CSS (masaüstü + mobil + print), rapor metni beyanları,
  `metadata.json` alanları ve **dokunulmazlar** (motor/CSV/şema/migration/
  workflow/yayımlanmış rapor). `test/inventory-qa.test.mjs` ve
  `test/dbh-qa.test.mjs` yeni ölçüte göre güncellendi (anıtsal gövdeli
  fikstürde doğal durum 🟢; 🟡/🔴 enjekte QA ile doğrulanır → sayılar üç
  durumda da aynı). Toplam **932 test yeşil** (`npm run check`).

### Düzeltildi — 0031 DBH tanımı ve kalite kontrol hükmü (DGR-2026-0016) (2026-09-29)
**Kök neden (veri sahibi kararı):** rapor hattı DBH'yi "gövde çevresinden
türetilmiş çap" olarak anlatıyor ve boy/çap oranına bakarak gerçek saha
verisini ⛔ BLOKLU ilan ediyordu. **DBH = göğüs çapı**dır (yerden 1,30 m),
birimi **cm**'dir ve sahada doğrudan çap olarak kaydedilir; DendroGeo
çevre→çap (÷π) dönüşümü **yapmaz**. 0011'in "kolon çevre olabilir"
varsayımı yanlıştı (kayıtlar 0013 ile zaten özgün değerlerine iade
edilmişti) ve haksız bir blok + "GEÇİCİDİR / KULLANILMAMALIDIR" hükmü
üretiyordu. **Karbon motoru, katsayılar, MC yapılandırması, `dbh_cm`
kolonu, CSV biçimi, veri tabanı şeması, LULC ve park analizi DEĞİŞMEDİ** —
düzeltilen yalnız açıklama metni ve QA hükmüdür; yeni migration YOKTUR.

* **§4.1/§4.2/§4.6/§5.1/§7/§9 metinleri:** DBH göğüs çapı (cm) olarak
  tanımlandı; "DBH = çevre ÷ π" beyanı, "sistemik birim hatası" ve
  "ölçü birimi hatası" hükümleri kaldırıldı. Her rapor **Ölçüm notu**
  cümlesini ve **§4.6 Veri sözlüğü** çizelgesini (DBH · cm · göğüs çapı;
  Boy · m; ρ · g/cm³; AGB/BGB/Karbon · kg; h/DBH · birimsiz) basar.
* **QA v3 (`inventoryQa`):** üç ayrı eksen — (a) **Envanter birim kontrolü
  (DBH)**: var → sayısal → > 0 → `1 ≤ D ≤ 400 cm` (kritik, sistemik ihlal
  bloklar); (b) **Boy/DBH oranı incelemesi**: `15–120` gösterge aralığı,
  **yalnız ⚠ İNCELEME — `hd_block` kalıcı `false`**; (c) **Karbon yeniden
  hesabı**: panel denklemi ±%20 ve mutlak fark ≥5 kg (kritik; DBH
  biriminden bağımsız hesap bütünlüğü kontrolü). Eski "Envanter tutarlılığı
  (h/d)" satırı kalktı.
* **Üç hâlli rapor durumu:** künyedeki sabit `<span class="st">Geçerli</span>`
  rozeti kaldırıldı; durum Çizelge 4'ten türetilir — 🔴 BLOKLU / 🟡 İNCELEME
  / 🟢 GEÇERLİ (`QA_STATE`, `qaStateOf`). Blok dışında GEÇİCİDİR /
  KULLANILMAMALIDIR damgası BASILMAZ. Göksu (park 25, n=34) aynı veriyle
  artık **🟡 İNCELEME** üretir (DBH 34/34 geçerli · oran 32/34 gösterge
  dışı · karbon yeniden hesabı 6/34 bant dışı).
* **`metadata.json`:** `variables` (veri sözlüğünün makine okur karşılığı),
  `measurementNote` (ölçüm notu), `qaState` + `qaStateLabel` alanları eklendi.
* **`scripts/import-measurements.mjs`:** `--birim cevre` ve `auto`'nun
  π ile bölme yolu **kaldırıldı** — `auto` artık her zaman cm kabul eder,
  boy/çap taşması yalnız uyarıdır; dosyada göğüs çapı kolonu yoksa (yalnız
  çevre kolonu varsa) içe aktarma durur. `girth_cm` ham denetim alanı olarak
  yazılmaya devam eder, DBH türetmek için kullanılmaz.
* **Doğrulama:** yayımlanan DGR-2026-0016'nın `data.json`'ı yeni kodla
  yeniden üretildi — tüm sayısal çizelgeler, `.ci` toplamı (52.29 t
  [%95 GA: 28.80–73.91]), t/ha değeri, 34/34 satır karbonu ve `DG_DATA`
  (web + print/PDF veri katmanı) **birebir aynı**; değişen yalnız QA
  hükmü/açıklama metni ve içerik hash'i (QA katmanı hash'e dahildir).
* **Belgeler:** `docs/methods.md` §1.5.1 yeniden yazıldı (DBH tanımı +
  QA v3 tablosu), `docs/rapor-yayini.md` §6 üç hâlli duruma güncellendi,
  `supabase/README.md` 0011 satırına ve `docs/DENETIM-2026-09-29.md`
  ilgili satırına düzeltme notu düşüldü. Migration dosyaları ve yayımlanmış
  `rapor/` çıktıları (immutable) DEĞİŞTİRİLMEDİ.
* **Bekçi:** `test/dbh-qa.test.mjs` (23 test) — motor/katsayı/MC
  değişmezliği, 0016 sayılarının birebir yeniden üretimi, yasak metinler
  (÷π, "sistemik birim hatası", GEÇİCİDİR, ⛔), veri sözlüğü + ölçüm notu,
  üç hâlli rozet, `hd_block` kalıcı false ve kod taraması (src/ + scripts/
  içinde DBH'nin π ile bölünmediği). `test/inventory-qa.test.mjs` ve
  `test/report-v2.test.mjs` yeni anlamlara göre güncellendi.

### Düzeltildi — 0029 workflow YAML kırığı: yayın kuyruğu durdu (2026-09-29)
**Kök neden (canlı kanıt):** 0028 yamasındaki iki adım adı tırnaksız
yazılmıştı ve değer ": " (iki nokta+boşluk) içeriyordu —
`- name: Kalp atışını başlat (0017 · 0028: workflow_dispatch)`. YAML'da
tırnaksız skaler ": " içeremez → `ci.yml` ve `rapor-yayin.yml` GitHub'da
HİÇ çözümlenemedi. Belirti zinciri: push koşuları jobsız "startup failure"
öldü (run adları dosya yoluna düştü), kalp'in rapor-yayin
`workflow_dispatch`'ı 422 aldı (kalp koşuları 30-33 step 6'da failure),
kuyruk boşalmadı — Göksu (park 25) yayın isteği 1 saatten fazla
"Beklemede" kaldı. **Düzeltme:** iki adım adı tırnağa alındı; beş
workflow'un tamamı js-yaml ile doğrulandı (5/5 parse OK).
**Bekçi:** `test/workflow-yaml.test.mjs` — aynı hata sınıfını push'tan
ÖNCE yakalar (name/description/title değerlerinde tırnaksız ": ", TAB
karakteri, eksik `on:` bloğu + 0028'in bozuk satırının bekçiyi
düşürdüğünü kanıtlayan regresyon testi). Bağımlılık eklemez.

### Düzeltildi — 0028 zincir + rapor çıktısı sertleştirmesi (2026-09-29)
**Zincir (kuyruk bekleme süresi):** `repository_dispatch` olaylarının
GITHUB_TOKEN'lu koşulardan gönderilince GitHub tarafından SESSİZCE
düşürüldüğü canlı kanıtlandı (29.09 17:36/19:44 kalp koşuları "başarılı"
dispatch yapmasına rağmen bayrak koşusu oluşmadı; geri çekme isteği
cron'a kaldı). Bayrağa giden TÜM tetikler (kalp zincir adımı,
rapor-yayin kapanışı, CI kuyruk işi) kanıtlı bacak olan
`workflow_dispatch`'a geçirildi; kalp zincir adımı dispatch sonrası
2 tur doğrulama + görünmezse yeniden tetikleme yapıyor.
**Rapor çıktısı (kullanıcı şikâyeti: "telefonda ve print/PDF'te düzgün
çıkmıyor"):** gerçek tarayıcı doğrulaması (headless Chrome ile mobil
ekran görüntüsü + A4 PDF) eklendi ve üç kusur düzeltildi — (1) yazdırma
medyasında harita figürü sayfalara bölünüp yarım boş sayfa bırakıyordu:
`.fig img` artık 182mm yükseklikle TEK sayfaya sığar; (2) kullanıcı
"arka plan grafikleri" kapalı bastığında rozetler/çubuklar/zeminler
kayboluyordu: `print-color-adjust:exact` zorunlu kılındı; (3) mobilde
tür tablosunun GRUP sütununda renk rozeti metnin üst satırına
kayuyordu: rozet+ad `span.grp` (inline-flex, nowrap) ile aynı satırda.

### Düzeltildi — 0010 geri çekme testleri ilk gerçek geri çekmeyle doğrulandı (2026-09-28)
DGR-2026-0001/0002'nin yayından kaldırılması (🗑) `rapor.test.mjs`,
`report-publish.test.mjs` ve `report-v2.test.mjs` içindeki 5 gizli kusuru
ortaya çıkardı: testler "her DGR dizini tam yayın dosyaları taşır" ve
"ilk yayın hâlâ Yayınlandı durumunda" varsayıyordu. 0010 sözleşmesine
uyarlandı: geri çekilen yayında yalnız bildirim sayfası kalır (veri
dosyaları ve hash beyanı aranmaz), günlükteki yayın+geri çekme satırları
birlikte doğrulanır, liste sayfası geri çekilen kimliği GÖSTEREMEZ.
Not: bot yayınında CI test işi koşmadığı için bu kusurlar canlıda ancak
şimdi görünür oldu — `npm test` artık canlı main durumuyla da yeşil (774).

### Düzeltildi — 0014: ikinci yayın isteği kalıcı bloke oluyordu (2026-09-28)
Göksu'da DGR-2026-0003 geri çekildikten sonra 📄 Yayınla "Bu park için
bekleyen bir istek zaten var" dedi ve yeni istek AÇILAMADI. Kök neden:
`report_requests_one_pending_per_park` kısmi unique index'i, kuyruk
tarafından İŞLENMİŞ ama DB'de 'Beklemede' kalan satırları da sayıyordu
(Actions'ın Supabase'e yazma yetkisi yok — 0008 güvenlik tasarımı; sonuç
git günlüğünde). Park bir kez yayınlandığında istek satırı asla
kapanmadığı için ikinci yayın kalıcı olarak bloke oluyordu.
- `0014_publish_request_fix.sql`: unique index kaldırılır. Çift üretim
  koruması asıl tek-gerçek-kaynakta kalır: panel yalnız "Beklemede VE
  günlükte sonucu olmayan" istekleri sayar; `planQueue` request_id'si
  günlükte olan istekleri atlar. Yeni test: `test/publish-request-fix.test.mjs`.

### Eklendi — 0025: park çalışma arkadaşı (davet + ortak ölçüm) (2026-09-29)
Kullanıcı isteği: "park çalışma arkadaşı daveti — beraber aynı projeye veri
girilmesini sağlasın."
- **SQL** (`0025_park_invites.sql`): `park_invites` + `park_collaborators` +
  `v_my_parks`; davet/kabul/red/iptal YALNIZ SECURITY DEFINER RPC ile
  (`dg_invite_send/respond/revoke`; tablolarda insert/update/delete grant'i
  YOK). Kabul `auth.uid()` ↔ `profiles.email` eşleşmesi ister (e-posta kimlik
  doğrulamaz). Kendine davet, mükerrer ortak, yetkisiz davet sunucuda reddedilir.
- **RLS genişletmesi (OR, daralma yok)**: `meas_select`'e ortak-park dalı —
  park sahibi ve ortaklar, ortak parkın projelerinin BEKLEYEN kayıtlarını
  görür (onay akışı). `projects_update` owner OR is_owner: ortak, paylaşılan
  projeyi Ölçüm sekmesinde seçebilir. Ölçüm mülkiyeti değişmez
  (`meas_insert owner=auth.uid()`): kimin ölçtüğü her zaman belli.
- **Arayüz**: 👥 kartı (v-admin: park seç → davet gönder, ortak/davet
  listeleri, geri al/kaldır) + 📬 kartı (v-projects: gelen davetler,
  Kabul/Red) + 🌳 paylaşılan park kutusu. Yeni CSS YOK (mevcut aileler).
  `loadProjects` ortak projeleri birleştirir; ortak satırında düzenleme/
  silme/rapor YOK (yalnız ölçüm girişi). Modül yokken/SQL kurulmamışken
  her şey sessizce eski davranışta (typeof + 42P01 korumaları).
- **Değişmeyenler**: konum çiti (0007), park bağı yalnız yönetici (0006),
  yayın kotası (0009), rapor yazar zinciri (0015 — veri sahibi önceliği;
  ortak ölçümleri park sahibinin raporuna doğal olarak dahil olur).
- Testler: `test/park-invites.test.mjs` (15: SQL sözleşmeleri + vm modül +
  kablolama) · check zinciri yeşil.

### Düzeltildi — 0027: waypoint tablosu + PDF/print dostu rapor + form cilası (2026-09-29)
Kullanıcı bildirimi: "waypoint listesi içeride sağa-sola hareket ediyor;
rapor formu hâlâ telefona uygun değil, PDF print dostu yap."
- **Waypoint tablosu** 0026'daki dg-cards dönüşümünden TEK eksik kalan
  tabloydu (inline max-height'li özel kapsayıcı) → kaba alındı + satırlara
  data-label (ID/Enlem/Boylam/Durum/İşlem). Mobilde artık satırlar kutu-kart;
  kapsayıcı içi sağa-sola kayma bitti (yalnız dikey liste kayar).
- Etiket eksiği kalan SON tablolar da kart düzenine bağlandı: dünya verisi
  (ülke/şehir), admin ölçüm/talep/kullanıcı tabloları (data-label'lar).
- **Rapor PDF/print katmanı** (make-report şablonu): @page 14mm · 0024'ün
  .tscroll kapları print'te KIRPIYORDU → overflow:visible + min-width:0 ile
  tablolar kağıda tam genişlik basılır · düğmeler gizli · şekil/satır/başlık
  bölünmez (break-inside) · 🖨 Yazdır / PDF düğmesi zaten künyede.
  Yayımlı raporlar donmuş — katman YENİ yayınlarda etkin.
- Form/panel mobil cilası: .shead dar ekranda sarar (rule gizli), .dg-act
  düğmeleri tam genişlik, LULC etiketi kendi satırında, panel dipnotları
  küçük punto; sekme şeridine overscroll-behavior-x:contain (kaydırma
  zincirlemez). sw r46→r47.
- Uyarı: yayın/geri çekme hattına (workflow, publish-queue, make-report
  ÜRETİM mantığı) DOKUNULMADI — değişiklikler CSS/şablon/satır-şablonu.

### Değişti — 0026: davet kartı Projeler’de + uygulama mobil düzeni (2026-09-29)
Kullanıcı geri bildirimi: "daveti admin sekmesine koydun — kullanıcı
kullanacak bunu, proje sayfasına koy; site telefondan saçma görünüyor."
- **👥 Park Çalışma Arkadaşları kartı v-admin → v-projects'e taşındı**
  (📬 davetlerin ve 🌳 paylaşılan park kutusunun yanı; projeler tablosunun
  altı). Admin olmayan park sahipleri de artık davet açabilir (yetki zaten
  sunucuda: RPC proje sahibi/admin şartı). shell go('projects') iki kartı da
  yükler; admin kancası kaldırıldı. Kimlikler (dgInvPark/dgInvList) aynı.
- **Uygulama mobil düzeni** (rapor sayfası 0024'te düzelmişti; kabuk eksikti):
  · 8 uygulama tablosu `dg-cards` sınıfına alındı → ≤640px'te TABLO→KART
    düzeni (mevcut sistem): başlık gizlenir, her satır "ETİKET: değer"
    kutusu olur; proje/kayıt satırlarına `data-label` eklendi.
  · `.card{overflow-x:auto}` GENEL kuralı kaldırıldı (tüm kartları — form
    kartları dahil — kaydırma kabına çeviriyordu; dokunmada "saçma" kayma
    hissinin kaynağı). Artık yalnız `.tblwrap` ve yalnız mobilde kayar.
  · Üst bar mobilde sakinleşir: yükseklik oto, 📲 Uygulama Kur gizli
    (telefonda mağaza/menüden), whoami daralır, yan küme sarar; sekme
    şeridi yapışkan kalır.
- Testler: park-invites kablolama + mobil sözleşmeleri (dg-cards sayısı,
  .card overflow yasağı, data-label'lar) · 845/845 yeşil.

### Düzeltildi — 0024: mobil düzen v2 — kaydırma kabı (2026-09-29)
0021'in mobil düzeltmesi telefonda YENİ bozulma üretti (kullanıcı bildirimi:
"§5 tür tablosu birbirine girdi, §7/§10/§12 kayıyor"): `table{display:block}`
thead ile tbody'yi AYRI tablo kutularına bölüp kolon hizalarını kaydırıyor,
`overflow-x:hidden` da başlıkları kırpıyordu. Doğru bilinen yöntemle yeniden:
- Rapor şablonundaki 6 tablo `<div class="tscroll">` kabına alındı; dar
  ekranda kab YATAY KAYAR (tablo normal düzeninde kalır, `min-width:520px`,
  kolonlar asla kaymaz). Masaüstünde kab nötr.
- `overflow-x:hidden` ve `display:block` KALDIRILDI; metinler
  `overflow-wrap:anywhere` ile kendi kutusunda kırılır → gövde genişlemez,
  başlıklar kırpılmaz.
- Kanıt: prova raporda 78/78 div dengesi, üretilen her tablo kabın içinde,
  `display:block`/`hidden` izi yok; report-author-qr testi 0021 hatasının
  GERİ GELMESİNİ de kilitliyor. 826+ test yeşil.

### Düzeltildi — 0023: bayrak adımı sertleştirildi (2026-09-29)
0022'nin ilk bayrak koşusu (16:45:00) 2 saniyede exit 1 öldü; adım logları
yetkisiz okunamadığı için kök neden kör noktada kaldı. Kör nokta bırakmama
ilkesiyle bayrak baştan yazıldı:
- TEK adım, `set +euo pipefail`, her yol `exit 0` — betik asla kendiliğinden
  ölmez; yaş çözülemezse GÜVENLİ TARAF seçilir (bayrak dikilir; mükerrer
  nabız kalp'in NEWER bekçisinde zaten elenir).
- Karar düz BASH string karşılaştırması — adım `if:` içinde GitHub ifade
  değerlendiricisi KULLANILMIYOR (0016'dan beri gizemli ölümlerin ortak
  şüphelisi).
- curl çıktısı dosyaya iner (boru zinciri kırılmaz), HTTP kodu loglanır
  (teşhis her koşuda görünür).
- Yerel kanıt: betik curl'süz ortamda bile exit 0 (hata yolu simülasyonu).
- Testler: heartbeat 0023 sözleşmeleriyle (15) · toplam 825+.

### Düzeltildi — 0022: zincir bayrağı — GitHub'ın sessiz özyineleme yasağı (2026-09-29)
Kullanıcı 10 dk bekleyince yapılan otopsi (kalp run adım zaman çizelgeleri):
kalp'in zincir adımı 15:38/15:51/16:16'da dispatch'i **202 OK** ile
gönderdi ama GitHub HİÇBİR koşu oluşturmadı — bir workflow GITHUB_TOKEN ile
KENDİSİNİ tetikleyemiyor (sessiz düşürme; aynı anda adım 'success' görünüyor,
bu yüzden üç tur fark edilmedi). Kanıtlı çalışan yol: FARKLI workflow'u
tetiklemek (kalp→rapor-yayin 15:27:15 ✓ · rapor-yayin→kalp 15:27:38 ✓).
- Yeni `rapor-bayrak.yml` (~10 sn, checkout yok): kalbin zincir hedefi;
  kalp son 4 dk'da koşmadıysa kalbi tetikler (cron yedeği de var).
- kalp zincir adımı: BAYRAK'ı tetikler + dispatch sonrası koşu oluşumunu
  DOĞRULAR ("202 ≠ koşu" dersi); ci.yml + rapor-yayin.yml bacakları da
  bayrağa çevrildi (tek düzen).
- Yedekler aynen: kalp */5 + 6h re-arm cron · bayrak */5 cron · her push.
- Testler: heartbeat 15/15 (bayrak sözleşmeleri dahil) · YAML parse ✓.

### Düzeltildi — 0021: rapor mobil düzeni (2026-09-29)
Kullanıcı bildirimi: "raporu telefondan açtığımda §5 Nicel Sonuçlar tablonun
dışına çıkıyor, genel görünümü bozuyor." Rapor şablonunda HİÇ mobil kırılım
yoktu; geniş tablolar (Çizelge 1 tür tablosu) `.wrap` gövdesini viewport
dışına taşıyordu. Eklenen `@media (max-width:640px)` katmanı: yatay taşma
kökten kilitli (`overflow-x:hidden`), tablolar kendi içinde YATAY
KAYDIRILABİLİR (`display:block;overflow-x:auto` — içerik asla ezilmez),
künye tek sütuna iner, hücre punto/boşlukları küçülür, uzun hash/kimlikler
`overflow-wrap:anywhere` ile kırılır, butonlar tam genişlik. Masaüstü ve
print/PDF düzeni DEĞİŞMEZ. Yayımlı raporlar donmuş olduğundan düzeltme
YENİ yayınlarda görünür (0010 sözleşmesi). Test: report-author-qr +1.

### Düzeltildi — 0020: tam denetim paketi (2026-09-29)
Sıfırdan uçtan uca denetim (depo + canlı site + DB + güvenlik + Actions +
rapor arşivi; kanıtlar: `docs/DENETIM-2026-09-29.md`). Kritik açık YOK;
817/817 test, 38/38 canlı varlık hash'i birebir, RLS probları geçti, kalp
zinciri canlı kanıtla ~5 dk ritimde (15:27'de push olmadan yayın+geri çekme
işledi). Giderilen kusurlar:
- Kök dizindeki boş ÇÖP dosyalar `cd`, `copy`, `git` silindi (canlıdaki
  /cd/ /copy/ /git/ 404'lerinin kaynağı; eski bir cmd kazası artığı).
- `/en/` giriş sayfası eklendi (dürüst "English · Beta" özeti; methods
  sayfasına ve TR uygulamaya bağlanır) + sitemap kaydı.
- `en/methods/index.html` bayat `?v=98461801` hash'i taşıyordu → en/
  sayfalarında `?v=` kaldırıldı (statik sayfalar, precache dışı).
- `docs/methods.md` ρ sınırlılık maddesi güncellendi (28/50 · 0011e).

### Düzeltildi — 0019: çatal ölümü kapatıldı, zincir ilk adıma alındı (2026-09-28)
Canlı otopsi (kalp koşu kayıtları): 0018 sonrası zincir 18 saat çalıştı
(gece boyunca 0006/0007/0008 yayın+geri çekmeleri push OLMADAN işlendi) ama
12:57'de cron ile CI tetiği 26 sn arayla İKİ kalp koşusu doğurdu; 4 dakikalık
İKİ YÖNLÜ bekçi yüzünden ikisi de "yakında koşu var, o devralır" deyip sustu
→ ÇATAL ÖLÜMÜ, zincir 2 saat koptu (12:57→15:07 boşluğu; kullanıcının
"50 dk'dır bekliyor" şikâyetinin kökü). Düzeltme:
- Zincir İLK adıma alındı (`if: always()`): iş adımları patlasa/iptal olsa
  bile ardıl tetik gönderilir — "ya hep zincir, ya devir".
- Bekçi TEK YÖNLÜ: susma yalnızca son 4 dk'da BENDEN YENİ bir kalp koşusu
  varsa (o koşunun uykusu daha sonra biter → zinciri kesin kurar). Akran
  koşular artık birbirini susturamaz; en kötü senaryoda iki zincir yan yana
  yürür (zararsız: üretim request_id + concurrency ile zaten tekil).
- Ritim `sleep 300` zincir adımının içinde; iş timeout 8 dk (bütçe ~5,5 dk).
- Testler 0019 sözleşmeleriyle güncel (heartbeat 11/11).

### Düzeltildi — 0018: kalp ritmi iş timeoutuna sığdırıldı (2026-09-28)
0017'nin bekçi DÖNGÜSÜ (sleep 240 × 12 gözlem) kalp işinin 5 dakikalık
timeout'unda BOĞULDU: ilk kalp koşusu 20:37'de başladı, 20:42'de
'cancelled' öldü, ardıl tetik hiç gönderilemedi → zincir doğmadan öldü
(canlı gözlem + run kaydı). Düzeltme:
- Ritim TEK `sleep 300`; iş timeout'u 12 dk (adım ~5,5 dk'da biter).
- Yığılma bekçisi: kuyrukta/başlamış ≥2 kalp koşusu varsa tetik atılmaz
  (cron + push + elle tetikler çakışsa da zincir TEK kalır).
- Anlık repository_dispatch korunur (0017'nin kanıtlı kısmı).
- Testler 0018 sözleşmeleriyle güncel (heartbeat 11/11).

### Düzeltildi — 0017: kalp zinciri anlık dispatch + bekçi (2026-09-28)
0016'nın zinciri 'delay_minutes'li ertelenmiş workflow_dispatch'e
dayanıyordu; GitHub bu depoda o koşuları HİÇ başlatmadı (gözlem: kalp
workflow kayıtlı, koşu sayısı 0 — ertelenmiş zamanlama da cron kadar
güvenilmez çıktı). 0017:
- Zincir artık **anlık repository_dispatch** (saniyeler içinde koştuğu
  20:17 bot dispatch'iyle aynı depoda kanıtlı) + **bekçi döngüsü**: son
  4 dk içinde bir kalp koşusu başladıysa tetik atılmaz → cron/push/elle
  tetikler üst üste binince zincir ÇOĞALMAZ, tekilleşir; döngü (12×4 dk
  gözlem, timeout 55 dk) zincirin devralındığını doğrular.
- ci.yml + rapor-yayin.yml kapanışı kalbi ANLIK tetikler (push = kalp
  hemen canlanır).
- Testler 0017 sözleşmeleriyle güncellendi (11/11).

### Eklendi — 0016: kendi kendini süren yayın kuyruğu (kalp atışı) (2026-09-28)
Kullanıcı: "biz push etmediğimiz sürece ne geri çekiyor ne yayın yapıyor —
adam gibi sistem kur." GitHub schedule güvenilmez çıktı ('*/5' cron 20
saatte 4 koşu) → `rapor-kalp.yml`: her koşu ardılını ~5 dk sonraya KENDİ
kaydeder (delayed workflow_dispatch, `if: always()`); nabız önce yalnız
HTTP ile kuyruğa bakar (boşta ~15-20 sn), iş varsa üretimi concurrency
kilitli `rapor-yayin.yml`'e devreder (tek üretici → çift DGR imkânsız).
Yedekler: */5 cron + 6 saatlik re-arm + CI push tetiği + rapor-yayin
kapanış zinciri. Rapor kuyruğu artık push beklemez; paneldeki "5 dakikada
bir" sözü gerçektir. Testler: `test/heartbeat.test.mjs` (11).

### Düzeltildi — 0015: yazar = veri sahibi + "tümü geri çekik" CI kazası (2026-09-28)
- **Yazar önceliği**: DGR-2026-0004'ün künyesinde istek sahibi (Sinan) yazdı;
  oysa 34 kaydın sahibi Nagihan. `0015_report_data_owner.sql` →
  `dg_park_author(park)` (SECURITY DEFINER; yalnız full_name/organization):
  motor artık ÖNCE parkın veri sahibine bakar, sonra istek sahibine (0012),
  o da yoksa kurumsal yazar. İSİM UYDURULMAZ.
- **CI kazası**: üç raporun aynı anda geri çekildiği anda (28.09 19:24) iki
  test "en az bir GEÇERLİ yayın var" varsayımıyla düştü — oysa tümünün geri
  çekilmiş olması MEŞRU durum. `rapor.test.mjs` + `report-publish.test.mjs`
  bu durumu tanıyor (geçerli yayın yoksa en az bir geri çekme kaydı şart).
  Her iki durumda da kanıtlandı: fc265a6 (tümü çekik) ✓ ve güncel main ✓.
- Testler: report-author-qr'a 0015 sözleşmeleri (+2) · toplam 802.

### Değişti — 0013: veri sahibinin kararı + kuyruk push tetiği (2026-09-28)
- **İade SQL'i** (`0013_restore_measurements.sql`): veri sahibi, Göksu
  kayıtlarındaki sayıların göğüs ÇAPI olduğunu beyan etti → 0011'in çevre/π
  dönüşümü `measurements_bak_0011` yedeğinden birebir geri alınır (34 kayıt,
  ~50,7 t). Idempotent koruma: yalnız hâlâ `dbh = girth/π` olan satırlar
  döner; iade sonrası elle düzeltmeleri ezmez. P7 ondalık kayması onarımı
  (196,2→1972,8) ve geom_json düzeltmesi korunur; `girth_cm` kanıt kolonu
  silinmez. Rapor QA v2.1 h/D kapısı bu veriyle ⛔ beyan basar (rapor yine
  üretilir/yayımlanır; "GEÇİCİDİR" uyarısıyla) — sistem bilimsel beyanından
  ödün vermez, karar veri sahibinindir.
- **Kuyruk push tetiği** (ci.yml `kuyruk` işi): GitHub schedule'ı ücretsiz
  depolarda düzensiz tetikleniyor (20 saatte 4 koşu gözlendi; yayın 2 saat
  bekledi) → yayın/geri çekme kuyruğu artık HER main push'unda da boşaltılır
  (dogrula ile paralel; `rapor-yayin-kuyrugu` concurrency grubuyla çakışmasız;
  rapor-yayin.yml ile birebir aynı push kalıbı). Zamanlayıcı yedek olarak kalır.
- **Panel şeffaflığı**: Ölçüm Yönetimi'nde Çap hücresi, 0011'den `girth_cm`
  taşıyan kayıtlarda "çevre: X cm" alt satırı gösterir (ham saha değeri
  görünür; kanıt kaybı yok).

### Eklendi — 0012: yazar = kullanıcı, QR, sıkı arşiv, 5 tür listede (2026-09-28)
Kullanıcı standardı: "yazar adı kullanıcının adı olsun; Şirin'ler site
kurucusu; DGR kimliği ve DOI'ye bağlanabilir altyapı korunsun; arşiv yer
kaplamasın."
- **Tür listesi (0011e)**: SALKIM SÖĞÜT, MAVİ LADİN, DOĞU ÇINARI, ATLAS
  SEDİRİ, CEVİZ kaynaklı ρ'larıyla (Zanne 2009 / Wood Database) seçim
  listesine GERİ kondu (kullanıcı onayı); AĞLAYAN SÖĞÜT listede YOK — yalnız
  eşanlamlı çözümlemede tanınıyor. Formül/katsayılar değişmedi (Chave 2014).
- **Yazar = yayını isteyen kullanıcı**: `0012_report_author.sql` →
  `v_report_authors` (full_name+organization; e-posta YOK; anon'a açık).
  Rapor künyesi, önerilen atıf, BibTeX (`author` + `contributor`), JSON-LD
  (`author` + `contributor`) ve metadata.json (`creators` + `contributors` +
  `creatorsNote`) buradan beslenir. Ad çözülemezse kurumsal yazar — İSİM
  UYDURULMAZ. Kurucular her raporda "Site kurucuları" olarak beyan edilir.
- **QR (standart md. 15)**: kalıcı rapor adresinin QR'ı künyede — build
  sırasında `qrcode` (MIT, devDependency) ile SVG üretilir, `data:` URI
  olarak gömülür → sayfada dış istek YOK, PDF/çevrimdışı çalışır.
- **Sıkı arşiv**: `data.json` + `metadata.json` artık minified (arşiv ~%40
  küçük); `publish-queue` her yayının `archive_bytes` değerini günlüğe yazar.
  Yayımlanmış (donmuş) raporlar DEĞİŞMEZ.
- Testler: `test/report-author-qr.test.mjs` (yazar/QR/atıf/metadata
  sözleşmeleri); CANARY 50/28.

### Değişti — 0011b: panel tür listesi eski halinde (kullanıcı isteği) (2026-09-28)
- `src/config/species.js`: SPECIES_DATA, 0011 ÖNCESİ 45 kaydın BİREBİR
  aynısına geri döndürüldü (seçim kutusu, ρ ve LATIN haritaları, panel
  `calc()` davranışı değişmedi). Göksu'nun 5 türü + AĞLAYAN SÖĞÜT
  `RESOLVE_ONLY_SPECIES` olarak YALNIZ çözümleyicide: rapor QA'sı ve import
  aracı, saklı carbon_kg'yi üreten 0011 ρ'larıyla (400/450/600/490/560)
  denetlemeye devam eder; `resolveSpeciesName` DB'deki 34 kaydı kanonik
  eşleştirmeye devam eder (§7 "Tür sözlüğü 34/34" ✓ kalır).
- QA karbon kapısına mutlak taban: `CARBON_DEV_MIN_KG = 5` — küçük
  kayıtlarda (örn. 10,6 kg) 0,1 kg saklama + 2 hane DBH yuvarlamasının
  ürettiği %20+ gürültü artık bayraklanmıyor (büyük kayıtlarda davranış aynı).
- `sw.js` r44 → **r45**; testler uyarlandı (772/772 + envanter 31/31).

### Düzeltildi — Envanter kalite paketi (0011 · QA v2.1) (2026-09-28)
Göksu Parkı (park 25 · 34 kayıt · 28.09.2026) saha denetimi üç sistemik
hatayı doğruladı; paket üçünü de kalıcı olarak kapatır.
- **B1 · Birim hatası (9x)**: cihaz çıktısının "Çap" kolonu GÖĞÜS ÇEVRESİ
  taşıyordu (34/34 kayıtta h/D 5–16; olgun ağaçta 20–100). Saha fotoğrafları
  ölçekle doğrulandı (P7 gövde ~35 cm ↔ çevre 107; P29 fidan ~13 cm ↔ 40;
  P32 ~64 cm ↔ 200). `0011_inventory_qa.sql`: ham değer `girth_cm`'e
  taşınır (SİLİNMEZ), `dbh_cm = round(girth_cm/π, 2)`; karbon+hacim panel
  denklemiyle yeniden → toplam 50,51 t ≈ **5,0–5,6 t**'a iner.
- **B2 · ρ okuma hatası (rapor hattı)**: `scripts/lib/mc.mjs loadRho()`
  species.js'i regex ile tarıyordu ama tablo anahtarları tırnaksız
  (`{tr:"…"}`) → rapor hattı HİÇBİR tür ρ'sunu okuyamıyor, her tür grup
  varsayılanına düşüyordu (panel ile rapor sessizce ayrışıyordu). Artık
  dosya vm'de çalıştırılıp gerçek tablo okunur; `mc.calcRow` panel
  `calc()` ile birebir (KARAÇAM 107/12 → 1972,8 kg iki tarafta da).
- **Tür sözlüğü 45 → 50**: SALKIM SÖĞÜT (Salix babylonica 400), MAVİ LADİN
  (Picea pungens 450), DOĞU ÇINARI (Platanus orientalis 600), ATLAS SEDİRİ
  (Cedrus atlantica 490), CEVİZ (Juglans regia 560) + kaynaklı ρ dolgusu
  (ρ'sız kayıt 28 → 6; kaynaklar: Zanne 2009 [Z09], Wood Database [WD]).
  `SPECIES_SYNONYMS` + `resolveSpeciesName()` (Türkçe-duyarlı normalizasyon)
  — "Ağlayan Söğüt"/"Cınar"/"CEVIZ" kanonik ada iner.
- **B3 · Park sınırı**: `parks.geom_json` (park 25) 5 noktalı DİKDÖRTGENdi
  (68,93 ha ≠ künye 50,11 ha) → LULC "alan dengesi" %37,6 farkla bloke.
  0011 gerçek OSM poligonunu yazar (way/423602737 · 111 nokta · ~50,00 ha;
  34/34 kayıt içinde). Rapor hattı ayrıca `bboxRing()` koruması kazandı:
  dikdörtgen geom_json YOK SAYILIR, OSM'e düşülür (§2/§7'de beyan).
- **QA v2.1 (rapor §7 Çizelge 4)**: 5 yeni otomatik kontrol — Tür sözlüğü
  eşleşmesi · Fotoğraf kanıtı · GNSS doğruluk kaydı · Envanter tutarlılığı
  (h/D) · Karbon yeniden hesabı. Sistemik ihlal (≥3 kayıt VE >%50) yayını
  BLOKLAR; §7 başlığı "GEÇİCİDİR" uyarısı basar. `accuracy_m` NULL iken
  rapor artık "±0,0 m" UYDURMUYOR — §4.1/§9 "kaydedilmedi" beyan ediyor.
- **Yeni araç** `scripts/import-measurements.mjs`: cihaz CSV/TSV çıktısını
  doğrular (birim auto-tespit, kanonik tür, panel denklemiyle yeniden hesap,
  mükerrer/çit denetimi) ve idempotent SQL üretir (`client_id` UNIQUE
  `dgi:<park>:<nokta>:<no>`). QA kapısı blokta SQL üretmez (`--force`
  damgalı üretir).
- **Kozmetik**: §2 kaynak cümlesinde `<code>` etiketi esc() içinde
  kayboluyordu (v2'den beri) → düzeltildi; bbox alanı tr sayı biçiminde.
- Testler: `test/inventory-qa.test.mjs` (30 test · ρ okuma, sözlük, QA
  kapıları, bbox, import aracı, render beyanları, SQL senkronu);
  allometry CANARY 50/6'ya güncellendi; `sw.js` r43 → **r44**.
- Belgeler: `docs/methods.md` §1.5/§1.5.1 (ρ kaynakları + çevre→DBH +
  kapılar), `supabase/README.md` (0011 satırı + uygulama sırası).

### Eklendi — Rapor standardı v2 + geri çekme (0010) (2026-09-28)
Kullanıcı standardı: **DGR — DendroGeo Bilimsel Analiz Raporu** kimliği resmen
tanımlandı; rapor bilimsel/teknik çizgide baştan yapılandırıldı; yanlışlıkla
yayımlanan raporlar yönetici VE kendi parkının sahibi tarafından 🗑 ile geri
çekilebilir.
- `scripts/make-report.mjs`: şablon v2 — belge künyesi (kimlik · durum
  "Geçerli" · konu · konum · tarih · analiz sürümü · veri dönemi 2021 ·
  çözünürlük 10 m) + resmi beyan ("akreditasyon/sertifikasyon belgesi
  değildir"); 14 bölüm + Ek A: Analiz Özeti, Analiz Alanı, Veri Kaynakları
  ("OSM verisi raster sınıflandırmanın yerine geçmez" açıkça), Yöntem (4.1–4.5
  genişletilmiş), Nicel Sonuçlar (Çizelge 1–3: türler + arazi örtüsü + ALAN
  DENGESİ sayıları), Harita, Kalite Kontrol (Çizelge 4: 10 otomatik kontrol),
  Değerlendirme (yalnız veriden türeyen betimleme — normatif dil yasak),
  Sınırlılıklar, Tekrar Üretilebilirlik, Analiz Parmak İzi (engine 4.2.0 ·
  uygulama 3.0.0 · git commit · EPSG · Result Hash · DOI "atanmadı"), Rapor
  Geçmişi (sürüm zinciri), Atıf (önerilen atıf + BibTeX + DOI notu), Kaynakça
  (Zenodo 10.5281/zenodo.7254221 · Chave 10.1111/gcb.12629 · ODbL). Şekil 1
  barları grup renkli: **ibreli yeşil, yapraklı turuncu**, diğer gri.
- `metadata.json` (yeni, rapor başına): DataCite Schema 4.7 deseninde makine
  okur üst veri (identifier/title/publicationYear/resourceType/version/
  spatialCoverage/temporalCoverage/resolution/methodVersion/sources/
  relatedIdentifiers/resultHash/gitCommit/doi=null+doiNote); sayfada JSON-LD
  (schema.org/Report) + `<link rel="alternate" type="application/json">`.
  DOI atandığında §11 + metadata.json + atıf bloğuna işlenir; DGR kalır.
- `harita.png` v2: alt bilgi şeridi (DENDROGEO - DGR-… · veri kaynağı ·
  çözünürlük · projeksiyon EPSG · analiz tarihi · motor sürümü · © DendroGeo),
  sağ üstte belge kimliği, segmentli ölçek çubuğu, harita çerçevesi; png.mjs
  glif kümesine © eklendi. Harita tek başına dolaşıma girse bile kaynağı belli.
- GEOMETRİ QA: elle çizilen park poligonlarında kendini kesen segment (düğüm)
  taraması (`ringSelfIntersections`, ≤600 nokta); düğüm varsa §2/§7/§9 sayıyla
  beyan eder ("9 kendini kesen segment çifti") ve arazi örtüsü çözümlemesinin
  QA eşiğine neden takıldığı açıklanır. Canlı durum: park 5'in uygulamada
  çizilen sınırında 9 düğüm var → raster/park alanı farkı %1,70 (eşik %0,5),
  bu yüzden o parkın LULC'li raporu üretilemiyor; sınır yeniden çizilince (ya
  da `geom_json` silinip OSM sınırına dönülünce) 📄 Yeni sürüm ile haritalı
  üretilir.
- GERİ ÇEKME (0010): `supabase/migrations/0010_report_retraction.sql`
  (`report_retractions` + `tg_report_retraction_gate`: biçim DG0RF, kimlik
  DG0RN, aktiflik DG0RI, mülkiyet DG0RP, kota DG0RQ, yineleme DG0RD; select
  anon, update YOK, delete yalnız yönetici; park başına tek bekleyen istek
  kısmi unique index). `scripts/publish-queue.mjs`: geri çekme fazı —
  park_id↔report_id eşleşmesi GÜNLÜKLE doğrulanır (eşleşmeyen işlenmez), veri
  dosyaları silinir, `renderRetractionNotice` bildirimi yazılır (noindex,
  gerekçe kaçışlanır), `rebuildIndex` listeden düşürür, günlük 'Geri çekildi'
  kaydı alır. Arayüz: yönetici kartı satırında ve kullanıcı panelinde
  **🗑 Geri çek** (onay + gerekçe sorar); rozetler 'Geri çekiliyor' /
  'Geri çekildi'; geri çekilen rapor bağlantı üretmez. Yeni CSS yok.
- `rapor/index.html`: Durum sütunu (Geçerli) + geri çekme açıklaması;
  `--reindex` CLI (liste elle yeniden kurulur). Dizin bu sürümde canlı
  yayınlarla (`DGR-2026-0001` Atatürk Çocukları ve Doğal Yaşam Parkı,
  `DGR-2026-0002` Ülkü Spor Tesisi) `--reindex` üzerinden yeniden kuruldu;
  yayımlanmış rapor dosyalarına dokunulmadı.
- KİMLİK BÜTÜNLÜĞÜ: v2 şablonunun prova çıktısı olarak yerelde üretilen park 5
  raporu **yayımlanmadı** — `DGR-2026-0002` kimliği canlı hatta Ülkü Spor
  Tesisi (park 4, kuyruk isteği `4ebe8320…`, 27.09.2026 23:47 UTC) için
  kullanılmıştı. Yayımlanmış raporlar dondurulmuş hâliyle kalır; prova çıktısı
  depoya girmez. Yeni bekçi: `test/report-v2.test.mjs` dizindeki her satırın
  parkını snapshot ve yayın günlüğü ile karşılaştırır (kimlik/park çakışması
  bir daha sessizce depoya giremez).
- Sürüm semantiği: her DGR 1.0 doğar (belge + metadata); düzeltme = geri
  çekme + yeni DGR; aynı parkın yeni analizi = yeni DGR + §12 geçmiş zinciri
  + metadata `IsNewVersionOf`. DGR-2026-0001 ve DGR-2026-0002 donduruldu
  (eski şablonda kalır); v2 şablonu bir sonraki yayından (DGR-2026-0003)
  itibaren üretilen raporlarda görünür.
- Bilinçli erteleme: QR kod (satılabilir kodlayıcı kararı gerekiyor; yanlış QR
  hiç QR'dan kötü) ve Zenodo/DataCite DOI kaydı (Faz 4) — metadata bugünden
  hazır. `docs/rapor-yayini.md` §6b + §4b.
- Testler: 681 → 740 (`test/report-v2.test.mjs` + `test/retraction.test.mjs`);
  rapor.test Şekil-1 kilidi yeni standarda güncellendi (grup renkleri).
  `sw.js` r42→r43.

### Eklendi — Kullanıcılar kendi park projelerinin raporunu kendisi yayınlar (0009)
Kullanıcı: **"kullanıcılar kendi park projelerini paylaşabilecek değil mi?"** →
doğrudan yayın seçildi. Hat aynı hat (report_requests → rapor-yayin.yml →
DGR + kalıcı bağlantı); değişen tek şey yetki kapısı.
- `supabase/migrations/0009_user_report_publish.sql`: yönetici olmayan
  kullanıcı, parkı için projesi varsa istek açabilir. Sunucu kilitleri (RLS +
  `tg_report_request_gate`, iki katman): mülkiyet (`REPORT_NOT_YOUR_PARK`),
  kendi onaylı ölçümü (`REPORT_NO_OWN_DATA`), 24 saatte 3 istek kotası
  (`REPORT_QUOTA`), `requested_by = auth.uid()` (`REPORT_NOT_SELF`) +
  `is_active()`. Kullanıcı yalnız kendi bekleyen isteğini iptal edebilir;
  0008'in kilitleri (park başına tek bekleyen istek, onaylı veri şartı,
  select anon'a açık, delete yalnız yönetici) aynen durur. Idempotent.
- `src/services/report-publish.js`: kullanıcı bölümü — 📁 Projeler'de parkı
  bağlı her satırda **📄** düğmesi, tablonun altında **Park Raporu** paneli
  (durum rozeti, 🔗 Aç / 📤 Paylaş / 📄 Yayınla / 📄 Yeni sürüm / ✖ Vazgeç,
  🛰 §4 tercihi, 25 sn'de bir kendiliğinden tazeleme). Yeni CSS yok; panel
  kullanılmadığında `display:none` → sıfır yer kaplar. Yazma çekirdeği
  (`dgPubInsertRequest` + hata eşleme) yönetici kartıyla ortak.
- Dürüstlük: panel her kullanıcıya söyler — rapor **park düzeyindedir**
  (parktaki tüm onaylı ölçümler), yayın kalıcıdır (hash ile dondurulur),
  kota 24 saatte 3 istektir.
- `sw.js`: CACHE_VERSION r42 · `docs/rapor-yayini.md`: kullanıcı kısa yolu +
  kilit tablosu · `supabase/README.md`: 0009 satırı/bölümü + uygulama sırası.
- Testler: 650 → 680 (`test/user-publish.test.mjs`: SQL kilitleri, 📄 düğmesi
  kablolaması, vm'de panel durumları + insert gövdesi + kota/mülkiyet hata
  eşlemeleri + başkasının isteğinde iptal yok + oynanmış günlük bağlantı
  sokamaz; 0008 bekçileri değişmeden yeşil).

### Eklendi — Site içinden rapor yayını: 📄 Yayınla → DGR bağlantısı kartta belirir
Kullanıcı: **"raporu site üstünden yayınlayacağım"** — GitHub Actions arayüzüne
gitmeden, uygulama içinden. Rapor motoru (R1+R3) aynı; değişen tek şey tetik:
elle `workflow_dispatch` yerine uygulama içi kuyruk.
- `supabase/migrations/0008_report_publish.sql`: `report_requests` kuyruğu.
  İsteği yalnız `is_admin()` açar (RLS + `tg_report_request_gate`, iki katman),
  okuma anon'a açık (yayın işi buradan okur), aynı park için aynı anda TEK
  bekleyen istek (kısmi unique index), onaylı ölçümü olmayan park için istek
  açılamaz (`REPORT_NO_DATA`). Idempotent.
- `src/services/report-publish.js` + 🔐 Ölçüm Yönetimi'nde yeni kart
  **"📄 Bilimsel Rapor Yayını"**: onaylı verisi olan parklar listelenir;
  📄 Yayınla / 📄 Yeni sürüm, ✖ Vazgeç, 🔗 Aç, 📤 Paylaş (Web Share + pano
  yedeği), durum rozeti, yayın günlüğü ve 25 sn'de bir kendiliğinden tazeleme
  (bekleyen istek varken, sekme görünürken). Yeni CSS yok, kart yalnız
  `v-admin` içinde → başka sekmenin düzeni kaymaz.
- `.github/workflows/rapor-yayin.yml`: 5 dakikada bir kuyruğu boşaltır
  (`concurrency` kilidi, rebase + 3 denemeli push, `contents: write`).
- `scripts/publish-queue.mjs`: bekleyen istekleri anon anahtarla OKUR,
  `publishPark()` ile üretir, sonucu `rapor/yayin-kuyrugu.json` günlüğüne
  yazar; işlenmiş `request_id` bir daha üretilmez.
- `scripts/make-report.mjs`: üretim çekirdeği `publishPark()` olarak dışa
  açıldı (CLI ve kuyruk aynı yolu kullanır); rapor sayfasına **📤 Paylaş**
  düğmesi eklendi (kalıcı bağlantıyı paylaşır/kopyalar).
- **Yetki modeli (bilinçli):** istek veritabanında, sonuç repoda. Actions
  Supabase'e YAZMAZ — `service_role` anahtarı depoda/tarayıcıda tutulmaz;
  iş salt-okunur anon anahtarla çalışır, sonucu git'e yazar (commit = denetim
  izi + yayın kanalı). Uygulama günlüğün yazdığı URL'ye güvenmez: bağlantı
  biçimi doğrulanmış `DGR-YYYY-NNNN` kimliğinden kurulur.
- `supabase/README.md`: 0007 + 0008 dosya listesine ve uygulama sırasına
  eklendi, 0008 için akış/güvenlik bölümü yazıldı · `docs/rapor-yayini.md`:
  tek sayfalık işletim rehberi.
- Testler: 619 → 650 (`test/report-publish.test.mjs`: şema/RLS/trigger,
  workflow kilidi, kuyruk planı + günlük bütünlüğü, vm'de arayüz davranışı —
  oynanmış günlük dış bağlantı sokamaz, yönetici olmayan istek açamaz).

### Düzeltildi — Rapor hattı saha geri bildirimi (Şekil 1/Şekil 2 + başlık dili + doğruluk beyanları)
- **Şekil 2 (harita.png) park sahasını artık tam gösteriyor:** hücre GeoJSON'u
  bellek koruması gereği 10.000 hücrede kesildiği için (bu parkta 13.396 hücre)
  poligonun bir dilimi boyanmıyordu; çizim, motorun KESİNTİSİZ run-length
  çıktısına geçirildi ve run bantlarının içbükey girintide kurduğu köprüyü
  kesen bir poligon kırpma geçişi eklendi → park sahası kapalı, beyaz/gri
  dilim yok; park dışı bağlam dokusu, beyaz halo'lu OSM sınırı, envanter
  noktaları ve sembol lejantı (sınır/nokta/bağlam) eklendi.
- **Şekil 1 barları yaprak yeşili:** dolgu `--leaf:#2f9e44`; bej `--line`
  yatağı yerine soğuk gri yatay yatak (`#e9ece8`) → küçük paylar turuncu/bej
  görünmüyor.
- **Başlık ve yöntem Türkçeleştirildi:** "Above-/Below-Ground" →
  "Toprak Üstü / Toprak Altı"; §2.2 "toprak üstü biyokütle (AGB)" ve
  "toprak altı biyokütle" olarak tanımlandı.
- **Şekil 2 açıklamasında çift yıl parantezi** ("(v200) (2021)") giderildi.
- **Doğruluk beyanı onarımı (hata düzeltmesi):** `geofence.verified_rows`
  artık varsayım değil, kayıt başına gerçek nokta–poligon testi
  (`pointInPolygon`); poligon dışı koordinat taşıyan miras kayıtlar §5'te
  ⚠ beyanı ile raporlanır. Moderasyon satırı da aynı kurala bağlandı:
  zaman damgası (reviewed_at) eksikse ✅ yerine ⚠ + açıklama.
- Testler: 609 → 619 (dil denetimi, çiti beyanı, pointInPolygon, Şekil 2
  tam örtüşüm + kırpma + nokta çizimi).

### Eklendi — Bilimsel Rapor Yayın Hattı (R1+R3): DGR kimlikli, değişmez, tez biçimi raporlar
Kullanıcı: "projeyi paylaşayım; site açılsın; sadece o park ve analiz raporu,
tez gibi, bütün veriler estetik; DOI gibi güvenilir referans olsun."
- `scripts/make-report.mjs`: park ID'den **dondurulmuş snapshot** üretir →
  `rapor/DGR-YYYY-NNNN/` altında statik sayfa + `data.json` + `olcum.csv` +
  `park.geojson` + `harita.png`. Sayfa kendi kendinin bütünlüğünü açılışta
  SHA-256 ile doğrular (crypto.subtle); künye, özet, yöntem (Chave 2014 +
  Monte Carlo + doğrulama zinciri), sonuçlar, arazi örtüsü, atıf (APA+BibTeX),
  sınırlılıklar ve yazdır/PDF içerir; og: etiketleri paylaşım önizlemesi verir.
- Sayıların kaynağı: canlı REST + `scripts/lib/mc.mjs` (MC, merkezli, seed'li)
  + uygulamanın KENDİ LULC motoru (vm içinde `dgLcAnalyze`) → uydurma değer yok.
- `.github/workflows/rapor.yml`: Actions → "Rapor Yayınla" (park_id girdisi)
  → üret → commit → Pages. Yerelde Node gerektirmez.
- İki gizli kusur bulunup düzeltildi: `canonicalHash` vm-realm nesnelerinde
  anahtar sıralamayı atlıyordu (instanceof → duck-typing); hash PNG
  buffer'ını imzalıyordu (ayıklama hash'ten ÖNCE). İkisi de bütünlük zincirini
  kırardı — testle kilitlendi.
- Dil: akademik kayıt dili (edilgen, terimler tanımlı); test gündelik kelime
  yasaklar. Şekil 2'nin temsilî olduğu kapasyonda açıkça yazar.
Kilitler: test/rapor.test.mjs (12 test). 609 test yeşil · check ✅
İlk yayın: rapor/DGR-2026-0001/ (Atatürk Çocukları ve Doğal Yaşam Parkı,
n=2, 24.02 t [%95 GA 13.17–34.22], LULC dahil, sha256 doğrulanmış).

### Düzeltildi — /en/methods/ 404'leri + kalıcı link bütünlüğü kilidi
KAZA (canlıda yakalandı): `/en/methods/` iki seviye derin ama göreli linkleri
tek seviye (`../`) yazılmıştı → `../yontem/` = `/en/yontem/` = **404** (GitHub
Pages), CSS/ikon da 404'tü. Tüm göreli yollar `../../` yapıldı.
KİLİT: `test/critical-fixes.test.mjs` → "link bütünlüğü" describe'i: 13 sayfanın
TÜM href/src'lerini dosya sisteminde çözer (ağ yok); kök-mutlak (`/x/`) ve
göreli (`../`) dahil; `http/mailto/tel/data/file` hariç. Bir sayfa taşınır ya
da derinlik değişirse test kırmızıya döner — bu kaza sınıfı kapandı.

### Değişti — Park Kimlikleri listesi: boş parklar düşmüyor (kullanıcı isteği)
İstek: "her park sorgulamada buraya yazıyor; projeye kayıt yapıldıktan sonra
buraya düşsün, boş projeler düşmesin."
- Park kimliği algılamada yazılmaya DEVAM eder (kimlik bütünlüğü + konum çiti
  için gerekli) ama **yönetim listesi varsayılan olarak yalnızca projesi VEYA
  kaydı olan parkları** gösterir.
- Boşlar silinmez: sayaçlı `🫥 Boş parkları göster (N)` düğmesiyle açılır,
  temizlemek isteyen 🗑️ ile siler; altta "N boş park gizlendi" notu.
- Çift kimlik ve isimsiz park uyarıları da filtrelenmiş küme üzerinde çalışır
  (gürültü azalır).
Kilitler: park-flow +2 davranış testi (varsayılan gizli / toggle aç-kapa).
583 test yeşil · check ✅

### Düzeltildi/Eklendi — kalite denetimi bulguları (2026-09-27, izinli küme)
Denetim: 12 sayfa + 10 sekme + landing, masaüstü+mobil; konsol/ağ/taşma/font/
buton/link/sitemap/WCAG. Fonksiyonel hata çıkmadı; aşağıdakiler denetim
raporunun İZİNLİ iyileştirme kümesidir (P6 kullanıcı tarafından kapatıldı:
red zaten geri alınabilir; P5 tembel modül risk nedeniyle BU TURDA YOK).
- **P1 kontrast (WCAG AA):** `--mut` #68766e→#5f6d65 (4.41→5.03), amber METİN
  tonu `--amber-ink:#9a4a08` (2.88→5.49); `--amber` dolgu/çizgi olarak kaldı.
- **P3 erişilebilirlik:** "İçeriğe atla" skip-link (mutlak konum, sıfır kayma),
  `:focus-visible` halkası, 22 form etiketi `div.lbl`→`label.lbl for=` (aynı
  kutu: `label.lbl{display:block}` → kayma yok).
- **P7 çit kesinliği:** Park Kimlikleri'ne 🛰 düğmesi — OSM sınırını çekip
  `parks.geom_json`'a yazar (çit daire yedeğinden tam poligona geçer); yalnız
  yönetici, RLS'ye tabi; CSP'ye `api.openstreetmap.org` eklendi (check-csp yakaladı).
- **P9 uluslararası:** `/en/methods/` sayfası + `hreflang` tr/en çifti + sitemap.
- **P2 listeden düşürüldü:** denetimdeki `width:100%` bulgusu SAHTE POZİTİFTİ
  (`max-width:100%` eşleşmesi); butonlarda inline genişlik yok.
KANIT: 139 öğe geometrisi (x/y/w/h) eski↔yeni karşılaştırıldı → 130 birebir
aynı, 9 farkın tamamı yeni skip-link'in ekran dışı kutusu (akışa etkisiz).
Kilitler: critical-fixes +4 test. 581 test yeşil · check ✅

### Düzeltildi — "bağla" UI'ları gerçekten çıktı + standart tema GERİ GELDİ (kabuk bozulmadan)
Kullanıcı (öfkeli, haklı): "parka bağlayı kaldır dedim duruyor; standart tema
yapmıştın geri bozmuşsun; sekme başlıkları (Waypoint/Plan) bozulmuş."
Teşhis: (1) "bağla" temizliği daha önceki bir pakette KAYBOLMUŞTU (commit
edilmemiş), kodda hâlâ duruyordu; (2) standart tema ile karşılaştırma kartı
çakışıyordu çünkü ui-standard'ın `.lead` kuralı, karşılaştırmanın
`dg-cmp-row lead` satırını 70ch'e daraltıyordu — iki istek aynı dosyada
çakıştığı için önceki turlarda biri düzeltilip diğeri bozuluyordu.
ÇÖZÜM (ikisi birlikte, kanıtlı):
- `dgScanLinkTarget`, `dgScanBindExisting`, "🔗 Bu parka bağla", "🔗 Bağla"
  select'i, "🌳 Parkı Algıla ve Bağla", "Proje oluştur / bağla" TÜMÜ silindi;
  yönetici yolu tek kapıdan: Yönetim → Park Kimlikleri (metinler "eşleştir"
  diline çevrildi).
- `ui-standard.css` kabuğa GERİ bağlandı ama style.css ile çakışan TÜM
  kurallar (.btn/.card/.alert/.badge/.lbl/.val/.lead/.tag + çıplak elemanlar)
  `.dg-page` (11 alt sayfa) kapsamına alındı; kabuğa yalnız çakışmasız
  `.view>h2` başlık ölçeği + yeni sınıflar girer. body'ler işaretli:
  kabuk `dg-app`, alt sayfalar `dg-page`.
- KANIT (hesaplanmış stil karşılaştırması): karşılaştırma kartı bugünkü
  canlıyla birebir (maxWidth none, 15px, mürekkep); sekme başlıkları standart
  dönemle birebir (23.2px Fraunces, #14532d). Ekran görüntüleri görsel olarak
  da doğrulandı.
KİLİTLER: ui-standard "kaza kilidi" (.lead/.badge/.btn/.card/.alert/.lbl/.val
global tanımlanamaz) + park-flow "bağla fonksiyonları GERİ GELMEMELİ".
577+ test yeşil · check ✅

### Düzeltildi — uzaktaki parka proje açılabilir + tüm CTA'lar canlı/tek aile (2026-09-27)
Kullanıcı: "uzaktaki bir parka proje oluşturamıyorum; proje oluşturabileyim,
sadece ölçüm giremeyim; GPS parkı algılasın… Hesapla ve Kaydet butonu da canlı
olsun, bütün butonlar aynı olsun."
- **Park Algılama kartına 🔍 ada göre arama** (`dgScanSearchByName`): önce
  kayıtlı parklarda `name_norm` arar, yoksa Nominatim koordinatı → `dgDetectAt`
  (aynı boru hattı). GPS artık yalnız ÖNERİ; uzaktaki parka **proje açılır**.
  ÖLÇÜM kapısı değişmedi: `saveMeas` konum çitiyle parkta olmayı zorunlu tutar
  (kartta yazılı olarak da belirtilir).
- **💾 Hesapla ve Kaydet CANLI:** 🌿/📡 ile birebir desen — `dgSaveBusy`:
  disabled + "⏳ Hesaplanıyor ve kaydediliyor…" + soluk + wait; `finally` ile
  her çıkış yolunda geri gelir.
- **CTA tek aile:** tam genişlik birincil butonlar (Kaydet, 🎯 Vardım, parola)
  `dg-png-btn primary`, ikincil `ghost`; eski `class="btn" style="width:100%"`
  deseni kabukta kalmadı.
Kilitler: critical-fixes +4 test. 576 test yeşil · check ✅

### Düzeltildi — Park Karşılaştırma kartı eski görünümünde + "kaldığın yerden devam"
Kullanıcı: "barları küçültüp en üsttekini kaydırmışsın, eski haline getir;
sayfayı yenilediğimde kaldığım yerden devam edebileyim."
- **ui-standard.css uygulama kabuğundan ÇIKARILDI** (yalnız 11 alt sayfada
  kalır): eleman seviyesi kurallar (h2/p/td/badge…) `.dg-cmp` barlarını ve
  lead satırını bozuyordu. KANIT: bozulma öncesi build (b6abd30) ile yeni
  build'in karşılaştırma kartı ekran görüntüleri **piksel özdeş** (md5 eşit).
- Kabuğun kullandığı tek sınıf (`.dg-sub`) `style.css`'e taşındı.
- `module-registry` kilidi güncellendi: `SUBPAGE_ONLY` istisnası + istisnanın
  kendisi kilitli (11 alt sayfa dosyayı GERÇEKTEN bağlıyor).
- **YENİ:** yenilemede son sekme + sekme içi kaydırma konumu geri gelir
  (`dg_last_view`, `dg_scroll_<sekme>`; tüm storage erişimleri try/catch,
  geçersiz sekme adında patlamaz; OAuth/recovery akışlarını etkilemez).
Kilitler: ui-standard "kabuğa sızmaz" + critical-fixes "kaldığın yerden devam"
(4 test). 572 test yeşil · check ✅

### Değişti — 📡 Konumu Etkinleştir artık CANLI buton (🌿 Yüzey Örtüsü Analizi ile birebir)
Kullanıcı: *"⏳ Analiz yapılıyor… gibi canlı buton yap; burayı incele ve buna
göre yap; saçma sapan farklı buton/tema/animasyon istemiyorum."*
- GPS kartı `dg-png-card` iskeletine geçti: `dg-png-head` + `dg-png-kicker`
  ("1 · SAHA KONUMU") + `dg-png-title` + `dg-png-sub` + canlı `dg-png-badge`
  (±m · ÇOK İYİ/İYİ/ORTA/ZAYIF) — yüzey analizi kartlarıyla aynı dil.
- Buton `class="dg-png-btn primary"` (LULC butonuyla aynı aile) ve aynı canlı
  desen: basınca `disabled` + "⏳ Konum alınıyor…" + opacity .65 + cursor wait;
  başarı/hata anında eski metnine döner (`dataset.oldText`). Yeni CSS/animasyon
  EKLENMEDİ (test kilidi: ui-standard.css'te @keyframes yok, .dg-png-btn ezilmez).

### Değişti — TEK tasarım sistemi: `css/ui-standard.css` (kullanıcı isteği)
İstek: *"📡 Konumu Etkinleştir butonunu canlı UI/UX'e göre yap (yüzey analizi
gibi); bütün sayfaların temaları, yazı stilleri, yazı renkleri, başlık/alt
başlık düzeni aynı olsun, bilimsel literatüre uygun; her sayfa/panel farklı
olmasın, butonlar aynı olsun."*

Ölçülen sorun: 11 alt sayfanın HER BİRİ kendi `<style>` bloğunda Arial gövde
yazısı, farklı yeşil (#14532d), farklı buton/başlık ölçüleri tanımlıyordu;
kabukta GPS butonu `.btn blue` + inline `width:100%` ile birincil CTA
ailesinden ayrışıyordu.

- **`css/ui-standard.css` (YENİ):** token anayasası (`--green:#1e6f4b`,
  Fraunces/Manrope/IBM Plex Mono), tipografi ölçeği (kicker/h1/h2/h3/h4/sub/
  meta), buton TEK aile (`.btn` + ghost/red/blue/amber/sm/lg/block), kart/
  alert/badge/tablo/form standartları. Her sayfada kendi stilinden SONRA
  yüklenir → aynı özgüllükte son kural kazanır; alt sayfaların Arial/dayatma
  stilleri eleman seviyesinde hizalanır (kendi sınıfları bozulmaz).
- **GPS bloğu** standart alan kartına geçti: `.card.dg-fieldcard` +
  `.dg-kicker` + `.dg-sub` + `.btn.block` (yüzey analizi kartlarıyla aynı dil).
- **11 alt sayfa** `../css/ui-standard.css` bağlar (kendi `</style>` sonrasında).
- `sw.js` r40: PRECACHE'e ui-standard.css eklendi (çevrimdışı alt sayfalar da
  standart görünür).
Kilitler: `test/ui-standard.test.mjs` (10 test). 567 test yeşil · check ✅

### Eklendi — konum doğrulaması + proje↔park kilidi (0007, kullanıcı isteği)
İstek: *"proje yapılacağı zaman veya projeye fotoğraf ekleneceği zaman konumdan
doğrulama alsın; aynı projeye farklı parklardan giriş yapılmasın; her proje park
ile eşitlensin; hatalı girişlerin önüne geçilsin."* İki katmanlı çit:

- **İstemci (`src/services/geofence.js`):** `dgFreshFix()` taze yüksek-hassasiyetli
  GPS (≤120 sn bayatlık, ±60 m hassasiyet eşiği); `dgGeoDecide()` saf karar —
  park poligonu içinde mi / kenara ≤40 m mi (GPS+OSM gürültü payı) / dışında mı.
  Proje açılışı (`dgScanCreateProject`) ve ölçüm+fotoğraf kaydı (`saveMeas`)
  doğrulanmadan BAŞLAMAZ; fotoğraf reddedilirse sunucuya hiç gitmez.
  Doğrulama damgası satırda: `geo_verified_at`, `geo_acc_m`, `geo_dist_m`.
- **Sunucu (`0007_geo_fence.sql`):** `trg_geo_fence` — istemci atlatılsa bile
  (elle API, eski sürüm, çevrimdışı kuyruk) park dışı ölçüm INSERT/UPDATE'i
  `23514` ile RED; tam poligon ray-casting (`dg_point_in_park`, jsonb),
  geometrisi olmayan miras parklar için alan-yarıçaplı daire yedeği.
  `trg_project_requires_park` — parksız yeni proje açılamaz ("her proje park
  ile eşitlensin"). Yönetici istisnası `geo_override_by` ile audit izi bırakarak
  mümkün; yetki sunucuda `is_admin()` ile yeniden denetlenir.
- **Geometri sunucuda:** tarama halkası `parks.geom_json`'a yazılır
  (`dgPersistParkGeom`, ≤500 nokta/halka) → çit daireyle değil poligonla karar
  verir; yazılamazsa sessizce daire yedine düşer (saha bloklanmaz).
- Eşikler tek yerde: `DG_GEO={ACC_MAX_M:60, MARGIN_M:40, FIX_MAX_AGE_S:120}`.
- Geriye uyum: mevcut satırlara dokunulmaz; parksız miras projeler çit dışında
  (onları `dgParkGate` + `trg_enforce_park_link` zaten kesiyor).

Kilitler: `test/geofence.test.mjs` (20 test) — poligon/margin/red/delik/hassasiyet/
miras-park kararları, halka sadeleştirme, saveMeas+proje+istisna kancaları,
index↔sw yükleme sırası, migration tetik/errcode/security-definer denetimi.

### Düzeltildi — "onayladığım kayıt haritada görünmüyor" (2026-09-26)
Kullanıcı bildirimi: *"son yüklenen veriyi onaylamama rağmen ne dünyada ne canlı
haritada göremiyorum."* Veritabanı tarafı sağlamdı — kayıt `status='Onaylı'`,
`shared=true`, RLS anon'a açık, REST aynı 12 satırı dönüyordu (canlı API'den
doğrulandı). Sorun istemcideydi; gerçek Chrome ile canlı sitede ölçülerek dört
ayrı kök neden kanıtlandı ve kapatıldı.

- **Çift işaretçi (Dünya sekmesi):** `addMarkersChunked` küme varsa
  TEMİZLEMEDEN ekliyordu. `loadWorld()` hem `startShell`'de hem her
  `approveMeas`'ta çalıştığı için küme 12 → 24 → 36 diye şişiyordu
  (ölçüldü: 2. `loadWorld` sonrası rozet "24", aynı nokta kümede 2 kez) ve
  tür/karbon analizi iki kez sayıyordu. Artık `clearLayers()` + çakışan
  turları iptal eden `_markerToken`. Ölçüm: 3 ardışık yükleme → 12/12/12, çift 0.
- **Canlı harita bir kez yükleniyordu:** `go("map")` içindeki
  `if(!liveLoaded){liveLoaded=true;loadLiveMap();}` kapısı yüzünden onaydan
  sonra sekmeye dönen yönetici eski kümeyi görüyordu; F5 şarttı. Yeni
  `DG_LIVE_DIRTY` bayrağı: onay/red/silme ve çevrimdışı senkronizasyon
  `dgMarkLiveDirty()` çağırır, sekme açılınca tazelenir (bayat değilse gereksiz
  sorgu atılmaz — ölçüldü: kirli 1 sorgu, temiz 0). Karta **↻ İşaretçileri
  tazele** düğmesi eklendi.
- **Sahte başarı mesajı:** `loadApprovedMarkers` sorgu `error`'ünü yok sayıyor,
  `catch` de yutuyordu → `done(0,[])` → ekranda YEŞİL *"✓ 0 onaylı kayıt
  yüklendi"*. `loadWorld()`'ün `catch(e){}`'sı ise her hatayı sessizce
  gömüyordu. Artık hata 3. argümanla taşınır (`n=-1`), kırmızı kutu + ↻ çizilir;
  `#worldErr` ve `#landingMapNote` ile Dünya/landing sekmeleri de açıklama basar.
- **Yanlış teşhis → veri kaybı riski:** `v_park_compare` 42501 (permission
  denied) döndüğünde `dgParkSchemaMissing` çağrılıyor, `DG_PARK_SCHEMA_OK=false`
  oluyor, ÖLÇÜM KAPISI kapanıyor ve yeni kayıtlar `park_id=null` yazılıyordu
  (`measure.js:278/318`). Yani geçici bir oturum/yetki hatası kalıcı veri
  bütünlüğü kaybına dönüşüyordu. Yeni `dgIsSchemaError()` yalnız gerçek şema
  hatalarını (42P01/42703/PGRST205) kabul eder; yetki/ağ hataları
  `dgParkCompareDenied()`'e gider ve şema bayrağına DOKUNMAZ. Yönetici artık
  zaten uygulanmış bir migration'ı yeniden çalıştırmaya yönlendirilmiyor.
- **"Null Island" tuzağı:** `Number.isFinite(+r.lat)` filtresi `+null === 0`
  olduğu için koordinatı NULL/boş gelen kaydı "geçerli" sayıp (0,0)a —
  Gine Körfezi'ne — çiziyor, küme sayısına gerçek ağaç gibi katıyordu. Yeni
  `dgValidCoord()` boş değeri, sınır dışını ve tam (0,0)ı reddeder; `world.js
  fitRows` (ülke/şehir yakınlaştırma) da aynı doğrulamayı kullanır.
- **Ölü kod:** `syncOfflineData()` içinde `updateSyncBadge()` çağrısı
  `return`'den SONRA yazılmıştı (hiç çalışmıyordu) → giriş yapılmamışken senkron
  rozeti takılı kalıyordu. Sıralama düzeltildi.

Kilitler: `test/map-refresh.test.mjs` (25 test) — çift işaretçi, token iptali,
hata iletimi, `DG_LIVE_DIRTY` kapısı, `dgIsSchemaError` sınıflandırması,
şema bayrağının düşmemesi, ölü kod ve koordinat doğrulaması. 531 test yeşil (+25).

### Değişti — ilk yükleme performansı (Faz 8)
Ölçüm (canlı site, gzip açık): sorun boyut değil **istek sayısı ve bloklama**ydı —
50 istek, 43 script'in tamamı `head`'de senkron, 10 dakikalık önbellek.

- **43 senkron script → hepsi `defer`**: HTML ayrıştırması artık script'leri
  beklemiyor, gövde hemen çiziliyor. `defer` belge sırasını koruduğu için modül
  zinciri ve `boot()` zamanlaması değişmedi.
- **LULC zinciri (8 modül) tembel**: `lazylibs.js → dgEnsureLulc()` yalnız
  "🌿 Yüzey Örtüsü Analizi"ne basıldığında sırayla enjekte ediyor
  (`async=false` → yürütme sırası korunur). `runLandCoverAnalysis()` artık
  `async` ve zinciri `await` ediyor; yüklenemezse sebep kullanıcıya gösteriliyor.
- **Google Fonts render'ı bloklamıyor**: `media="print"` + `onload="this.media='all'"`
  + `preload` + `<noscript>` yedeği.
- **8 ön bağlantı**: supabase.co (oturum sorgusu), challenges.cloudflare.com
  (Turnstile), fonts.gstatic.com, a/b/c.tile.openstreetmap.org,
  nominatim, overpass → DNS+TLS el sıkışması önceden.
- **Landing haritası tembel**: `IntersectionObserver` (rootMargin 400px) + 6 sn
  yedek; işaretçiler harita kurulunca yükleniyor (yarış bayrağıyla).

Sonuç: istek **50 → 42**, wire **277 → 250 KB**, blokluyan script **43 → 0**.
`sw.js` PRECACHE değişmedi → çevrimdışı davranış aynı.

### Eklendi
- `test/load-order.test.mjs`: tüm script etiketlerinin `defer` olduğu, LULC
  zincirinin index.html'de BULUNMADIĞI ama `DG_LULC_CHAIN`'de doğru sırada
  olduğu ve analiz köprüsünün zinciri beklediği kilitlendi.

## [3.0.0] — 2026-09-24

> 📦 **Zenodo:** [10.5281/zenodo.22948643](https://doi.org/10.5281/zenodo.22948643) ·
> GitHub Release `v3.0.0` (commit `56c7c4f`) · önceki sürüm:
> [10.5281/zenodo.22646300](https://doi.org/10.5281/zenodo.22646300) (v1.0.0)

Bu sürüm **iki büyük mimari değişiklik** içerir: ölçümler artık proje adına değil
**fiziksel park kimliğine** bağlanır ve giriş yöntemlerine **Google OAuth** eklenir.
Ayrıca veri tabanı şeması genişlediği (0004→0006) ve **lisans MIT'ten CC BY-NC 4.0'a
değiştirildiği** için SemVer gereği büyük sürüm artışı yapıldı.

> ℹ️ **Sürüm numaralandırması:** Bu sürümden itibaren proje **3.x** olarak
> numaralandırılıyor (proje sahibinin kararı, 2026-09-24). Daha önce arayüzde
> görünen `v11.0` dahili bir numaralandırmaydı ve hiçbir zaman GitHub
> Release/Zenodo sürümü olarak yayımlanmadı; bu yüzden `v3.0.0` ilk resmî
> etiketli sürümdür. Aşağıdaki `[11.0.0]` kaydı o dahili dönemi belgeler.
>
> ⚠ **Geriye dönük uyumsuz:** v11.x'ten yükseltirken `supabase/migrations/`
> altındaki 0002→0006 dosyaları sırayla çalıştırılmalıdır. 0004 uygulanmadan
> park kimliği devre dışı kalır (uygulama çökmez, proje adı bazlı yedeğe düşer
> ve ekranda uyarı gösterir).

### Eklendi

**Park kimliği mimarisi (0004–0006 + `src/services/park-registry.js`)**
- `public.parks` tablosu: fiziksel parkın **tek kimliği**. Canonical anahtar OSM
  elemanı (`way/123456`); OSM'de yoksa `manual/<ad>/<~100 m hücresi>`. UNIQUE
  kısıtı sayesinde aynı park iki kez kaydedilemez.
- `projects.park_id` + `label` + `park_name`; `measurements.park_id` (denormalize).
- `trg_compose_project_name`: proje adı **veritabanında** kurulur →
  `park adı - etiket` (örn. `Göksu Parkı - deneme`). İstemci kuralı unutsa veya
  bypass etse bile ad bozulamaz.
- `trg_enforce_park_link`: park bağı olmayan projeye ölçüm INSERT edilemez
  (`PARK_REQUIRED`, SQLSTATE `DG0PK`). UPDATE'te proje değişmiyorsa denetlemez —
  eski kayıtların onay akışı kilitlenmez.
- `trg_enforce_park_admin` (0006): mevcut bir projenin park bağını yalnız
  `is_admin()` değiştirebilir (`PARK_ADMIN_ONLY`). Yeni proje açmak için park
  algılamak herkese açık (saha akışı kilitlenmesin).
- `v_park_compare` view'ı: karşılaştırma artık **sunucuda** park bazında
  `group by` yapıyor → istemcideki `.limit(5000)` kesilmesi bitti; katkıda
  bulunan kişi sayısı, proje sayısı, tür sayısı, alan ve **t/ha** yoğunluğu geliyor.
- Ölçüm kapısı: parkı olmayan proje seçiliyken `Yeni Ölçüm` sekmesi kullanıcıyı
  doğrudan **park algılama ekranına** yönlendirir (proje başına bir kez; kapan
  döngüsü olmasın diye) ve kayıt düğmesi kilitlenir.
- Park algılama kartı: adım adım akış (parkı bul → kimliği doğrula → proje),
  "📍 Konumumdan algıla", OSM'de park yoksa **elle park oluşturma**.
- Kimlik birleşmesi: aynı ad + yakın konum → farklı OSM kimliği bile olsa TEK
  park. Yarıçap `sqrt(alan)` (50 ha park ~707 m) — canlıda yaşanan çift kimlik
  vakasından sonra 250→400 m taban ve `sqrt/2`→`sqrt` olarak düzeltildi.
- Yönetim aracı **🌳 Parkları Geri Doldur**: park bağı olmayan eski projeleri
  ölçüm merkezinden eşleştirir. Üç kademeli arama (1500 m → 3500 m → ada göre
  Overpass), canlı ilerleme çubuğu, önce **önizleme** sonra onay, eşleşmeyen
  satırlar için **✍️ elle park oluştur ve bağla**.
- Yönetim aracı **🌳 Park Kimlikleri**: çift kimlikleri ad+mesafe ile bulur,
  ✏️ yeniden adlandırır (`name_norm` da güncellenir), 🔀 birleştirir (projeler +
  ölçümler taşınır, adlar yeniden kurulur, kaynak kimlik silinir), 🗑️ siler
  (bağ kopar, veri silinmez). Otomatik birleştirme **bilerek yok**: aynı adlı iki
  ayrı park olabilir, karar yöneticide.

**Onay ve moderasyon**
- **📋 Park → Proje → Kullanıcı ağacı** (`src/services/admin-tree.js`): tüm
  durumlar (onaylı + bekleyen + red) tek yerde, `<details>` ile kademeli açılır.
- 🔴 **Onay bekleyen rozetleri** dört seviyede: park, proje, kullanıcı ve yan
  menüdeki `🔐 Ölçüm Yönetimi` öğesi (sekme açılmasa da yanar).
- "🔴 Sadece bekleyenler" filtresi ve "Bekleyenleri aç" kısayolu; sıralama onay
  kuyruğuna göre (bekleyen önce, sonra karbon azalan).
- Sorgu hatası artık **sessizce "Kayıt yok."a dönüşmüyor**: üç kademeli zincir
  (tam embed → gömüsüz çekip istemcide birleştir → hata kutusu + 🔄).
- Fotoğraf önizlemesi: moderasyon listesi, onay ağacı ve Kayıtlarım'da 40×40
  kapak görseli (`loading="lazy"`), tıklayınca yeni sekmede tam boy.

**Kimlik doğrulama**
- 🔵 **Google ile giriş** (Supabase OAuth). Logo satır içi SVG (dış kaynak yok),
  `prompt=select_account` (sahada ortak tablet), girişten sonra `?code=`
  temizlenir.
- `dgWaitForOAuthSession`: supabase-js URL'deki kodu arka planda takas ettiği
  için `boot()` takasın bitmesini bekler — beklemezse kullanıcı Google'dan
  başarıyla döndüğü hâlde landing'i görürdü.
- **KVKK açık rıza**: kayıt formunda onay kutusu (aydınlatma + gizlilik
  bağlantıları; konum, fotoğraf, kamuya açık veri seti ve yurt dışı
  barındırma açıkça sayılıyor). Rıza yoksa kayıt engellenir; rıza zaman
  damgasıyla auth metadata'sına yazılır (`kvkk_consent_at`).

**Yasal sayfalar ve uyum**
- `/gizlilik/` (12 bölüm), `/aydinlatma/` (KVKK m.10), `/kullanim-kosullari/`,
  `/kunye/` (künye + **içerik kaldırma süreci** + erişilebilirlik beyanı).
- **Harita atıfları**: 4 haritanın hiçbirinde atıf yoktu → `DG_ATTR` tek
  kaynağından ODbL/Esri/CC-BY-SA tam metinleri; PNG çıktısına telif satırı.
- **Lisans**: `LICENSE` MIT → **CC BY-NC 4.0** (kod + belge + veri birlikte);
  `NOTICE` eklendi (telif sahipleri, atıf biçimi, üçüncü taraf lisansları).
- **Kişisel e-posta kaldırıldı**: kurucunun gmail adresi 13 yerde geçiyordu →
  `sinan@dendrogeo.org`; migration'daki kurucu ataması placeholder'a çevrildi.
- JSON-LD: `Dataset` düğümü zenginleştirildi (gerçek kişi yaratıcılar,
  `isBasedOn` ile OSM/ESA atıfları, park kimliği değişkenleri), `sameAs`,
  `privacyPolicy`, `termsOfService`, `copyrightHolder`.
- `CITATION.cff` (Zenodo'nun okuduğu künye) ve bu `CHANGELOG.md`.

### Değişti
- Karşılaştırma sayfası **park bazlı**: `Park Karşılaştırma — Karbon
  Performansı` artık proje adlarını değil algılanan parkları listeliyor; aynı
  parktaki tüm kullanıcıların verisi tek satırda. Park bağı olmayan eski
  kayıtlar kaybolmuyor, "⚠ Park algılanmamış kayıtlar" bölümünde duruyor.
- Proje formu: serbest "Proje Adı" alanı kalktı → **park + etiket** ve canlı ad
  önizlemesi. Projeler tablosuna **Park** sütunu eklendi.
- Ölçüm Onay & Moderasyon **tek kartta**: hiyerarşik ağaç önde, düz liste
  katlanır `<details>` içinde.
- **Mobil düzen**: karşılaştırma satırları ve yönetim tabloları satır içi
  stilden sınıflara taşındı; ≤640px'te tablolar **kart düzenine** dönüyor
  (`data-label`), karbon barı alta iniyor, ağaç girintisi azalıyor.
- `projects_update` RLS politikası `is_admin()`'i de kapsıyor (geri doldurma
  aracı başkalarının projelerini de parka bağlayabiliyor).
- `v_park_compare` yalnız `authenticated`'a açık: view `security_invoker`
  olduğu için anon'a grant vermek `permission denied` üretiyordu.
- `arriveWp()` ölçüm formunu waypoint'in projesine geçiriyor (kapı doğru
  projeyi değerlendirsin).
- Grid/waypoint panelindeki proje listesi algılanan parkla sınırlandı.
- Service Worker `r35 → r37`; yeni modüller PRECACHE'te.

### Düzeltildi
- **PGRST201**: 0003 `measurements.reviewed_by` FK'sını eklediği için
  `measurements → profiles` arasında iki ilişki oluşmuştu; çıplak
  `profiles(full_name)` gömüsü "more than one relationship" hatası veriyor ve
  moderasyon tablosu sessizce "Kayıt yok." basıyordu → `profiles!measurements_owner_fkey`.
- **Asılı kalma**: `sb.from(...).order(...)` zinciri supabase-js'te geçersiz
  (`order` yalnız `select()` sonrası) → `TypeError` → onay ağacı sonsuza dek
  "⏳ Ölçümler yükleniyor…"da kalıyordu. Test sahtesi artık API biçimine sadık;
  repo genelinde canary eklendi.
- **Fazla `</div>`**: iki kart birleştirilirken kalan fazladan kapanış
  `v-users` bloğunu `#main` dışına itmişti → 👥 Kullanıcı Yönetimi bozuk
  görünüyordu. `test/ui-audit`'e yapısal denge kilitleri eklendi.
- **Türkçe büyük/küçük harf tuzakları**: `initcap('işçi')` → `Işçi` (yanlış)
  olduğu için `dg_tr_title()` elle eşleme kullanıyor (0005); `/isimsiz/i`
  deseni `İsimsiz`'i eşleştirmiyordu → uyarı hiç çıkmıyordu; `"İ".toLowerCase()`
  birleşen nokta ürettiği için park adı normalizasyonu elle çözülüyor.
- `parks_id_seq` USAGE grant'ı eksikti → `authenticated` rolü park kaydı
  eklerken `permission denied for sequence` alıyordu.
- Rıza kutusunda `consentEl.focus()` savunmacı çağrıya çevrildi.

### Altyapı
- **`.gitattributes`**: birinci taraf metin dosyaları **LF**'e sabitlendi
  (`vendor/` bilerek hariç — üçüncü taraf baytlarına dokunmuyoruz). Sebep:
  `manifest.json` CRLF ile commit edilmişti; yama Windows'a aktarılırken LF'ye
  döndüğü için `git am --3way` "patch does not apply / Did you hand edit your
  patch?" hatası veriyordu. `test/release.test.mjs` CRLF'in geri gelmesini
  ve vendor'ın değişmesini kilitliyor.

### Güvenlik
- `parks` RLS: okuma herkese (OSM türevi kamusal veri), yazma
  `created_by = auth.uid() and is_active()`, silme yalnız `is_admin()`.
- Park kaydı **upsert ile yapılmıyor**: upsert çakışmada UPDATE'e döner ve
  ikinci kullanıcı RLS'e takılırdı → select → insert → (yarışta 23505) yeniden
  select.
- Ölçüm kapısı hem istemcide hem sunucuda (`trg_enforce_park_link`).
- Parka bağlama yalnız yöneticide (istemci bekçileri + `trg_enforce_park_admin`).
- Fotoğraf adresleri `esc()` ile escape ediliyor (XSS kilidi testte).
- Depoda kişisel e-posta kalmadığını doğrulayan test (mutasyonla kanıtlandı).

### Test
- **450 → 503 test**. Yeni dosyalar: `test/park-identity.test.mjs` (kural +
  şema + kabuk kilitleri), `test/park-flow.test.mjs` (sahte Supabase/DOM ile
  uçtan uca akış, 13 bölüm), `test/admin-tree.test.mjs`,
  `test/google-auth.test.mjs`, `test/compliance.test.mjs` (hukuki uyum),
  `test/release.test.mjs` (sürüm tutarlılığı).
- Test sahtesi supabase-js API biçimine sadık hale getirildi (yanlış zincir
  sırası artık testi kırıyor); yürüyücülerin boş tarama yapıp sahte yeşil
  vermesi mutasyon testleriyle engellendi.
- Migration zinciri (0001→0006) yerel PostgreSQL 15 üzerinde Supabase
  stub'ları ve **gerçek rollerle** iki kez çalıştırıldı; RLS, trigger ve view
  davranışları doğrulandı.

---

## [11.0.0] — 2026-09-22 (dahili sürüm, etiketlenmedi)

Modüler mimariye geçiş ve performans fazları (ayrıntısı git geçmişinde):

- **Faz 1–3:** `index.html` inline script → `src/ui/{state,toast,landing,shell}.js`;
  landing stilleri `css/landing.css`'e ayrıldı; `index.html` artık
  `partials/{head,landing,shell,boot}.html`'den **üretilen artifakt**
  (`npm run build`, `build:check` ile CI'da kilitli).
- **Faz 4:** `gridplan.js` (3980 satır) yedi modüle bölündü (park zinciri:
  `park-state → osm-client → park-geometry → park-query → grid-engine →
  ui/park-panel → ui/park-export`).
- **Faz 5:** `landcover.js` (1779 satır) altı modül + ince facade oldu (LULC zinciri).
- **Faz 6:** `admin.js` beş modüle bölündü (yönetim zinciri).
- **Faz 7:** `geotiff` (317 KB) ve `chart.js` (208 KB) **tembel yükleme**ye geçti
  (`src/utils/lazylibs.js`) → landing açılışı ~525 KB hafifledi.
- Kritik düzeltmeler: STAC araması GET'e döndü (CORS preflight 405), ziyaret
  sayacı RLS-safe hale getirildi, `?v=` hash'leri içerikten türetilmeye başlandı
  (`version-sync.mjs`), Service Worker'da PRECACHE/RUNTIME ayrımı.
- Denetim: 0002 (e-posta gizliliği, waypoint sahip yetkisi, bileşik coğrafi
  indeksler) ve 0003 (denetim izi `reviewed_by/reviewed_at/reject_reason/deleted_at`,
  onay damgası trigger'ı, `v_world_agg` toplulaştırma view'ı).

---

## Sürüm öncesi kontrol listesi

```bash
npm run check        # sözdizimi + ?v= + build + CSP + 482 test
```

- [ ] `package.json`, `manifest.json`, `CITATION.cff`, `partials/head.html`
      (`softwareVersion`), `partials/landing.html`, `SECURITY.md`,
      `kunye/index.html` sürümleri **aynı** (`test/release.test.mjs` kilitler)
- [ ] `CHANGELOG.md` güncel
- [ ] Yeni migration varsa `supabase/README.md` + `dendrogeo-tam-kurulum.sql` güncel
- [ ] `sw.js` `CACHE_VERSION` artırıldı (modül kümesi değiştiyse)
- [ ] GitHub Release + Zenodo adımları: `docs/surum-yayini.md`

[3.0.0]: https://github.com/snansrin/dendrogeo/releases/tag/v3.0.0
[11.0.0]: https://github.com/snansrin/dendrogeo/releases/tag/v11.0.0
