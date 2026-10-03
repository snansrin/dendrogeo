# DendroGeo — 10 m Arazi Örtüsü / 2020 Yöntemi

## 1. Amaç

DendroGeo park analizinde sınıflandırma sonucu seçilen park polygonu ile 10 m çözünürlüklü kategorik arazi örtüsü rasterının hücre-kesişimlerinden hesaplanır.

Sistem örnek nokta oranını alana çevirmez, her hücreyi körlemesine 100 m² kabul etmez ve eksik alanı başka sınıflara zorla dağıtmaz.

## 2. Veri kaynağı

Kaynak ürün: Impact Observatory · 10m Annual Land Use Land Cover (9-class) V2.

Ürün küresel yıllık 10 m arazi örtüsü haritalarını Cloud Optimized GeoTIFF (COG) biçiminde ve UTM kaynak karolarına hizalı olarak yayınlar. 2020 analizinde yalnızca gerekli veri karolarının data raster varlığı okunur. Lisans CC BY 4.0'dır.

Resmî kaynaklar:

- https://planetarycomputer.microsoft.com/dataset/io-lulc-annual-v02
- https://planetarycomputer.microsoft.com/api/stac/v1/collections/io-lulc-annual-v02
- https://registry.opendata.aws/io-lulc/
- https://www.impactobservatory.com/legal/lulc-methodology-accuracy.pdf

## 3. Kaynak sınıflar

| Kod | Sınıf |
|---:|---|
| 1 | Su |
| 2 | Ağaç |
| 4 | Taşkın vejetasyon |
| 5 | Tarım |
| 7 | Yapılı alan |
| 8 | Çıplak zemin |
| 9 | Kar/buz |
| 10 | Bulut |
| 11 | Rangeland / mera |

0 NoData olarak ele alınır.

## 4. DendroGeo dört sınıf eşlemesi

| DendroGeo | Kaynak kodları |
|---|---|
| 🌿 Yeşil alan | 2, 4, 5, 11 |
| 💧 Su | 1 |
| 🧱 Sert zemin | 7 |
| 🟫 Çıplak zemin | 8 |

Kod 9 ve 10 ile NoData dört sınıfa sessizce dağıtılmaz.

## 5. Zonal alan hesabı

1. Kullanıcının seçtiği park polygonunun WGS84 geometrisi alınır.
2. Polygon bounding box ile 2020 STAC araması yapılır.
3. Polygonu kesen gerekli UTM COG karoları bulunur.
4. Her karonun gerçek raster metadatasından piksel sınırı, boyutu ve kaynak grid çözünürlüğü alınır.
5. Yalnızca polygon bbox ile kesişen raster penceresi COG üzerinden okunur.
6. Her raster hücresinin polygon ile kesişim alanı çokgen-kutu kesişiminden hesaplanır.
7. Rasterın kategorik hücre değeri bu kesişim alanına atanır.
8. Her sınıfın alanı, hücre içinde polygon tarafından kapsanan gerçek alanların toplamıdır.
9. Yüzdeler rasterın polygon içindeki gerçek kapsama alanına göre hesaplanır.
10. Kaynak hücre sayısı yalnızca kalite kontrol bilgisidir; hektar hesabının girdisi değildir.

Bu yaklaşım, coverage fraction / coverage area mantığıyla çalışan standart hassas zonal istatistik yöntemleriyle uyumludur.

## 6. Alan kapanış kalite kontrolü

Dört ana sınıfın toplamı, tüm raster hücreleri geçerli sınıflardan oluşuyorsa analiz alanını kapatır.

NoData, kar/buz veya bulut hücresi bulunursa bu alanlar başka sınıflara aktarılmaz. Ayrı maskeli/veri dışı alan olarak gösterilir.

Raster-polygon kapsama alanı ile seçilen park polygonu arasında %0,5'ten büyük fark oluşursa analiz durdurulur. Sistem farkı oranlayarak kapatmaz.

## 7. OSM'nin rolü

OSM bina, yol, otopark ve su geometrileri arazi örtüsü sayısal sonucuna müdahale etmez.

Bu geometriler grid planlama gibi diğer işlevlerde kullanılabilir. Arazi örtüsü raporunun sınıf değeri yalnızca seçilen park polygonu ve 10 m LULC rasterından gelir.

Arazi örtüsü analizi sırasında kırmızı bina/yol çizgileri otomatik olarak haritaya bindirilmez.

## 8. Görselleştirme

Harita üzerindeki sınıf görünümü yalnızca görsel doğrulama içindir. Sayısal alan hesabı görselleştirme katmanından bağımsızdır.

Yeşil, su, sert zemin ve çıplak zemin sınıfları kaynak raster kodlarının DendroGeo gruplarına göre renklendirilir.

## 9. Dışa aktarma

CSV dört ana sınıfın kaynak hücre sayısını, alanını ve yüzde değerini içerir. Maskeli/NoData alanı ayrı bir QC satırı olarak tutulur.

GeoJSON çıktısı, geçerli 10 m raster hücrelerini ve polygon içindeki gerçek kesişim alanlarını içerir.

## 10. Yöntemin gerekçesi

Kaynak ürün COG olarak yayınlandığı için web uygulaması yalnızca gerekli raster pencerelerini okuyabilir. Ürünün UTM kaynak-gridine hizalı olması, kategorik 10 m hücrelerinin doğal raster koordinat sisteminde işlenmesini sağlar.

Doğru ilke, hücre sınıfını polygon içinde kalan gerçek yüzölçümüyle ağırlıklandırmaktır. Salt hücre sayısını 10 m × 10 m ile çarpmak sınır hücrelerinde hata oluşturur.

## 11. Kaynak ve doğruluk notu

Impact Observatory'nin yayınladığı yöntem/doğruluk özetinde yıllık haritaların bağımsız insan etiketleriyle doğrulandığı ve çoğunluk uzlaşımı ölçütünde yıllık haritaların en az yaklaşık %76 doğruluk düzeyine ulaştığı bildirilir.

2024 tarihli bağımsız karşılaştırmalı çalışmada ESRI LULC ailesi için raporlanan genel doğruluk %85,0'dır. Bu değer belirli bir parkın gerçek sınıflandırma doğruluğunun garantisi değildir.

Bu nedenle DendroGeo sonuçları park içindeki kaynak raster sınıflarının alan dağılımı olarak sunulur; bina sınırı veya yol geometrisi kadar ayrıntılı nesne envanteri olarak yorumlanmamalıdır.
---

## Güncelleme v4 (2026-09-20): çift kaynaklı motor + nesne tanımlama

Bu bölüm önceki metni geçersiz kılmaz; motorun v4 ile kazandıkları eklenir.

### 1. Neden değişti

İki sorun vardı:

1. **QA hatası (kök neden):** STAC `datetime` sorgusu io-lulc koleksiyonunda
   2020 isteğine 2019 karosunu da döndürebiliyordu. Filtresiz kod iki karoyu
   işleyip alanları topluyordu → `assigned ≈ 2 × park` →
   "Raster/park alanı QA başarısız: %99.61 fark". Artık her item id/properties
   üzerinden yıla göre süzülüyor (`dgLcItemMatchesYear`).
2. **Tematik yetersizlik:** io-lulc (arızi kullanım ürünü) Göksu Parkı gibi
   kentsel yeşil alanları "yapılı" sınıfına atıyordu (yeşil 0 ha, sert 39 ha).
   Park ölçeğinde bilimsel olarak kullanılamazdı.

### 2. Yeni kaynak düzeni

| Rol | Ürün | Yıl | Çözünürlük | CRS |
|---|---|---|---|---|
| **Birincil** | ESA WorldCover v200 (Sentinel-1+2 füzyonu, 11 sınıf) | 2021 | 10 m | EPSG:4326 |
| **Çapraz** | IO LULC v02 (9 sınıf) | 2020 | 10 m | UTM |

ESA karoları derece uzayında olduğu için hücreler metrede anizotropiktir
(~7,1 × 9,3 m, 40° enlemde). Hücrenin dört köşesi analiz UTM'sine projekte
edilir ve park poligonuyla **tam dışbükey kesişim** (Sutherland-Hodgman,
yarı-düzlem dizisi) alınır. Alanlar hücre sayımı değil gerçek kesişim
alanıdır; hücre toplamı park alanına eşittir (QA eşiği %0,5).

### 3. Çapraz doğrulama (belirsizlik)

Her grup için iki kaynağın alanları raporlanır ve uzlaşma yüzdesi
`100·(1−|a−b|/(a+b))` ile verilir. Göksu Parkı örneği:

| Grup | ESA 2021 | IO LULC 2020 | Uzlaşma |
|---|---|---|---|
| Su | 12.50 ha | 11.04 ha | %94 |
| Sert | 14.71 ha | 39.01 ha | %55 |
| Yeşil | 22.26 ha | 0.00 ha | %0 |

Uzlaşmanın düşük olduğu gruplarda birincil kaynak esas alınır; düşük uzlaşma
**bilgi olarak** raporlanır (io-lulc'ın kentsel yeşil alan zaafı belgelenmiştir).

### 4. Nesne tanımlama

Aynı sınıfa ait 4-yön bitişik 10 m hücreler bağlantılı bileşen analiziyle
tek nesne sayılır. Çıktı: nesne sayısı, nesne başına alan ve alan-ağırlıklı
merkez (≥0,05 ha). Göksu Parkı'nda su kütlesi tek nesne olarak 12.47 ha
çıkar; sert zemin ayrı bloklara (yol/meydan parçaları) ayrışır.

### 5. Doğrulama

* `scripts/lulc-qa.mjs --park "Göksu Parkı"`: Overpass'ten gerçek polygonu
  çekip aynı boru hattını Node'da çalıştırır (tarayıcısız QA).
* Göksu Parkı (way/423602737, 109 köşe, 50.05 ha):
  su **12.50 ha**, sert **14.71 ha**, yeşil **22.26 ha**, QA farkı **%0.000**.
  Saha bilgisiyle (su ~12,5 ha, sert ~15 ha) uyumlu.
* `test/landcover-v4.test.mjs`: yıl filtresi regresyon kilidi, 4326 hücre
  alanı, dışbükey kesişim ↔ rect denkliği, nesne/uzlaşma matematiği.

## Güncelleme v5 (2026-10-03): Doğrulama Çalışma Sahası (accuracy assessment)

Sürüm 4'e kadar sistem sınıf alanlarını ÜRETİYOR ama bağımsız olarak
ÖLÇMÜYORDU (çapraz uzlaşma tek belirsizlik göstergesiydi). v5, park
paneline üç adımlı bir doğrulama katmanı ekler. Bu katman sayısal alan
sonuçlarını DEĞİŞTİRMEZ; ölçer, işaretler, beyan eder (motor ve yayın
hattı dokunulmadan kalır).

### 1. Üç bağımsız kanıt hattı

| Hat | Kaynak | Tür |
|---|---|---|
| A · Spektral | Sentinel-2 L2A (Planetary Computer), bulutsuz medyan kompozit + mevsimsel kalıcılık taraması | otomatik |
| B · Görsel | Esri World Imagery (~0.5 m) üzerinde tabakalı örnek noktaların İNSAN etiketi | altın standart |
| C · Vektör/çapraz | OSM su-yol rafinasyonu + IO LULC uzlaşması (v4'ten beri mevcut) | otomatik |

### 2. Örnekleme tasarımı (B hattı)

Olofsson vd. (2014) tabakalı rastgele örnekleme: tabaka = haritalanmış sınıf;
tabaka başına eşit sayıda nokta (nadir sınıfın UA güven aralığı dar kalsın
diye); tohumlu PRNG (mulberry32) → aynı tohum aynı noktalar (tekrar
üretilebilirlik, kampanya JSON'unda parmak izi). Kenar hücreleri (alanı
%60'ın altında park içinde) örneklenmez: 10 m piksel park sınırını
kesiyorsa referans belirsizleşir.

### 3. Metrikler (C karne)

Ağırlıklar Wᵢ TAM SAYIM raster alanlarından (örneklem oranından değil).
OA±CI95, sınıf bazında UA±CI95 ve PA, alan düzeltmeli hektar ±CI95,
ağırlıklı Cohen kappa — formüller Olofsson vd. (2014), RSE 144:48-57
(kod içi yorumlarda denklem denk türetme; test/lc-validate.test.mjs
elle hesaplanmış referans değerlerle kilitler). Kararsız (❓) etiketler
paydada kalır, paya girmez → muhafazakâr doğruluk.

### 4. Spektral kurallar (A hattı) — literatür çapalı eşikler

* Su: (a) MNDWI ≥ 0.20 ve MNDWI ≥ NDVI (Xu 2006 + görelilik) VEYA
  (b) yıllık MAX MNDWI ≥ 0.45 ve taç baskın değil (ndvi/ndviYear < 0.50)
* Yeşil: NDVI ≥ 0.35 VEYA yıllık MAX NDVI ≥ 0.50 (bahar yeşillenmesi)
* Sert: kuru + IBI > 0 (Xu 2008) + [NDVI ≥ 0.20 VEYA (IBI > 0.10 ve
  yıl boyu vejetasyonsuz: ndviYear < 0.25)]
* Çıplak: kuru + NDVI < 0.20 + (IBI ≤ 0.10 VEYA mevsimsel yeşillenme
  ndviYear ≥ 0.25 — toprak baharda yeşerir, asfalt yeşermez)
* Kalan: belirsiz (sınıfa zorlama YOK; insan kuyruğuna gider)

Çok zamanlı kanıt (ilkbahar şub-may + sonbahar eki-ara pencereleri, ayrı
S2 taraması) WorldCover sınıf SEMANTİĞİYLE hizalamadır: sınıf 80 "yılın
çoğunda su", sınıf 10/30 "vejetasyon varlığı" demek; yaz medyanı tek
başına mevsimsel göl kıyısını ve kuru step çayırını yanlış görür.

### 5. İki parkta canlı kalibrasyon kanıtı (2026-10-03, scripts/val-qa.mjs)

**Göksu Parkı (park 25, 50 ha, göllü):** 6 yaz sahnesi (☁ %0.8-1.3) +
5 kalıcılık sahnesi; 7804/7864 hücre profillendi. Yeşil uzlaşma %90.2;
su %67.1 — uyuşmayan 605 su hücresinin yıllık MAX MNDWI medyanı 0.13:
2021 boyunca (şub-ara) hiçbir sahnede açık su DEĞİL → mevsimsel çekilen
göl kıyısı/çamur; WorldCover 80 bu kıyıyı ıslak yıla dayanarak içeriyor.
Bu hücreler kırmızı konturla insan incelemesine kuyruklanır (uydurma
sınıf düzeltmesi YAPILMAZ). Sert %38.2: ağaç gölgeli yollar yaz
medyanında karışık piksel — beklenen fizik.

**Atatürk Çocukları ve Doğal Yaşam Parkı (park 5, 85 ha, yarı kurak
step):** yeşil uzlaşma bahar yeşillenmesi kanıtıyla %22.5 → %55'e çıktı
(+2686 hücre); kalan uyumsuzluk yarı kurak step sürekliliğidir (seyrek
çayır ↔ çıplak ↔ sert ayrımı 10 m spektralinde zayıftır — literatürde
belgeli) ve B hattına (insan) devredilir.

### 6. Kapı eşikleri (doğrulama rozeti)

🟢 DOĞRULANDI: OA ≥ %80 VE κ ≥ 0.60 VE su UA ≥ %90 VE spektral uzlaşma
≥ %70 VE n ≥ 30 · 🔴 KRİTİK: OA < %65 VEYA su UA < %75 · 🟡 aradaki her
durum/örneklem yetersiz. Dayanak: WorldCover 2021 v200 küresel OA
%76.7±0.5 (PUM V2.0); park ölçeği küresel karışımdan homojendir → %80
hedefi makul. Eşikler testle kilitli (DG_VAL_GATE).

### 7. Kalıcılık ve dışa aktarım

Kampanya IndexedDB'de (park başına, otomatik kayıt 5 etikette bir);
CSV (nokta listesi + matris + metrikler) ve JSON (şema
`dendrogeo-lc-validation/1`: tohum, sahne id'leri, motor sürümü,
metrikler, hüküm) — ileride DGR raporlarına doğrulama bölümü olarak
bağlanmaya hazır (make-report KIRMIZI ÇİZGİ: bu sürümde dokunulmadı).

### 8. Sınırlılıklar (dürüst beyan)

* Esri altlığının görüntü tarihi parktan parka değişir (2021 haritası ↔
  güncel görüntü): mevsimsel/değişim kaynaklı ayrışma meşrudur, karne
  dönemi beyan eder.
* A hattı eşikleri Göksu + park 5 canlı koşularıyla kalibre edildi;
  farklı biyomlarda (ör. tropik) yeniden değerlendirme gerekir.
* Otomatik uzlaşma DOĞRULUK DEĞİLDİR; doğruluk yalnız B hattı (insan
  referansı) ile üretilir. A hattının işi şüpheli hücreyi kuyruklamaktır.

### 9. v5.1 sadeleştirmesi (0054 · 2026-10-03): Hassasiyet Paneli

Kullanıcı geri bildirimiyle üç adımlı çalışma sahası arayüzü (A/B/C
sekmeleri, örneklem turu, karne) KALDIRILDI; yerine rapor barlarının
altında tek panel geldi:

* **Kaydırıcı = eşik:** her sınıf için 0-100; 50 = §4'teki literatür
  kalibrasyonu (değişmez, testle kilitli). Eşikler taban etrafında doğrusal
  kayar (`dgValThr`): yeşil NDVI 0.35±, su MNDWI 0.20±, sert IBI 0.00±,
  çıplak NDVI bandı 0.20±. Kaydırıcı önbellekteki spektral profili yeniden
  sınıflar (ağ isteği yok).
* **Aday = spektral ≠ raster:** aday hücreler haritada sınıf rengiyle
  kesikli işaretlenir; kullanıcı uydu altlığında GÖZÜYLE doğrular ve
  ✅ Kabul / ❌ Harita doğru der. Kararlar park başına kalıcıdır
  (IndexedDB) ve denetim izlidir (hücre, eski→yeni sınıf, zaman damgası,
  spektral kanıt değerleri).
* **Güncel veri:** varsayılan tarama GÜNCEL sezon Sentinel-2'sidir
  (WorldCover 2021 değil) — adaylar hem sınıflandırma hatasını hem 2021'den
  bu yana GERÇEK DEĞİŞİMİ yakalar; ayırım insan kararına bırakılır.
* **Doğrulanmış alan:** onaylar `applyCorrections` ile raster alanlarına
  uygulanır (saf fonksiyon; ham sonuç DEĞİŞMEZ) → "Onaylarınla" satırı
  düzeltilmiş ha ± Δ gösterir; GeoJSON/CSV dışa aktarılır.
* §2-§8'deki örnekleme/metric bilimi KÜTÜPHANE olarak durur
  (`lc-validate.js`, 79 testle kilitli); ileride rapor hattına resmî
  doğruluk bölümü bağlanmak istenirse hazırdır.
