# Yöntem

Bu belge DendroGeo'nun ürettiği her sayının nasıl hesaplandığını, hangi
sabiti nereden aldığını ve bilinen sınırlılıklarını açıklar. Amaç: bir
okuyucunun repoyu açmadan sonuçları yeniden üretebilmesi.

---

## 1. Biyokütle ve karbon

### 1.1 Üstü gövde biyokütlesi (AGB)

Chave vd. (2014), pantropikal ağaçlar için yayınlanan allometrik denklem
(Eq. 4 biçimi):

```
AGB [kg] = 0.0673 · (ρ · D² · H)^0.976
```

* `ρ` — odun yoğunluğu, **t/m³** (tablo kg/m³ tutar, 1000'e bölünür)
* `D` — göğüs yüksekliği çapı (DBH), **cm**
* `H` — toplam boy, **m**

Kaynak: Chave, J. ve ark. (2014). *Improved allometric models to estimate the
aboveground biomass of tropical trees.* Global Change Biology 20(10).

### 1.2 Kök biyokütlesi (BHB)

```
BHB = AGB × 0.26
```

Sabit kök/gövde oranı kullanılır. Bu bir **basitleştirmedir**: literatürde
oran biyoma ve türe göre değişir (Cairns vd. 1997; Mokany vd. 2006 ~0,18-0,30).
Yol haritasında grup bazlı orana geçiş var.

### 1.3 Toplam biyokütle ve karbon

```
BIO  = AGB + BHB
C    = BIO × 0.47
```

0,47 karbon oranı IPCC varsayılanıdır. Thomas & Martin (2012) türe/biyoma
göre %45-52 aralığı bildirir; ibrelilerde ~0,50'ye yakındır. **Bugün tek
sabit kullanılıyor** — Türkiye ağırlıklı bir veri setinde bu, ibreliler için
sistemli olarak düşük karbon demektir. Yol haritasında grup bazlı oran var.

### 1.4 Hacim

```
V [m³] = π · (D/200)² · H · 0.5
```

Silindir hacmi × 0,5 gövde form faktörü. Form faktörü tür ve boy sınıfına
göre değişir; 0,5 yaygın bir ortalama varsayımdır.

### 1.5 ρ (odun yoğunluğu) kaynak zinciri

`src/config/species.js` içindeki tür tablosu aranır; tür yoksa grubun
varsayılanı kullanılır:

| Grup | ρ (kg/m³) | Kaynak |
|---|---|---|
| İBRELİ | 446 | Tolunay 2013; NIR Turkey 2017; 299 Nolu Tebliğ 2017 |
| YAPRAKLI | 541 | aynı |
| DİĞER | 493 | aynı |

Tür bazlı değerler tabloda satır sonu yorumuyla KAYNAKLI listelenir
(örn. Kızılçam 478 [Z09], Atlas Sediri 490 [WD]):

* **[Z09]** Zanne vd. (2009), *Global wood density database* (Dryad,
  doi:10.5061/dryad.234) — cins/tür düzeyi temel odun yoğunluğu.
* **[WD]** The Wood Database (wood-database.com), "Specific Gravity (Basic)".
* **[T13]** Tolunay (2013) — grup varsayılanları.

Kaynaklandırılamayan tür **bilerek `rho:null` bırakılır** (uydurma değer
yasağı); hesap grup varsayılanına düşer ve raporda beyan edilir.
**0011b (2026-09-28 · kullanıcı isteği): panel SEÇİM LİSTESİ 45 kayıtta
sabitlendi** — Göksu envanterinin 5 türü (SALKIM SÖĞÜT, MAVİ LADİN, DOĞU
ÇINARI, ATLAS SEDİRİ, CEVİZ) `RESOLVE_ONLY_SPECIES` olarak yalnız
çözümleyicide tanınır; seçim kutusunda, `rho`/`LATIN` haritalarında ve
panel `calc()` zincirinde YOKTUR (bu türler için panel hesabı grup
varsayılanına düşer — 0011 öncesi davranış). Rapor QA'sı ve içe aktarma
aracı ise `loadSpeciesDict().byName` üzerinden gizli kayıtların kaynaklı
ρ'larını (400/450/600/490/560) kullanır: saklı `carbon_kg` değerlerini
üreten 0011 CASE'i ile birebir denetim. ρ, AGB'ye ~0,976 üssüyle girdiği
için %20 ρ hatası ≈ %19,5 karbon hatası demektir — veri setinin en büyük
belirsizlik kaynağı olmaya devam eder.

**Eşanlamlı çözümleyici.** Saha kayıtları/cihaz çıktıları kanonik ad dışında
yazım üretebilir ("Ağlayan Söğüt", "Cınar", "CEVIZ"). `resolveSpeciesName()`
Türkçe-duyarlı normalizasyon + `SPECIES_SYNONYMS` ile adı kanonik forma
indirger; DB'ye her zaman kanonik ad yazılır. Rapor QA'sı ("Tür sözlüğü
eşleşmesi" satırı) eşleşmeyen adları SAYIYLA beyan eder.

### 1.5.1 DBH tanımı ve envanter kalite kapısı (0031)

**DBH = göğüs çapı** (*Diameter at Breast Height*): ağacın yerden **1,30 m**
yükseklikteki gövde **çapı**, birimi **cm**. Saha ekibi değeri doğrudan çap
olarak ölçer ve kaydeder; `measurements.dbh_cm` kolonu bu ham ölçümü taşır.

> **DendroGeo rapor hattında çevre→çap (÷π) dönüşümü YAPILMAZ.**
> 0011 döneminde "cihazın Çap kolonu aslında çevre taşıyor" varsayımıyla
> `dbh_cm` değerleri π ile bölünmüş ve rapor metnine DBH'nin gövde
> çevresinden türetildiği beyanı yazılmıştı. Bu varsayım **yanlıştı**:
> kayıtlı değerler göğüs çapıdır.
> 0013 migrationı kayıtları özgün saha değerlerine iade etti; 0031 de
> rapor metnini, QA hükmünü ve içe aktarma aracını bu tanıma göre düzeltti.
> Karbon motoru, katsayılar, `dbh_cm` kolonu, CSV biçimi ve veri tabanı
> şeması bu düzeltmede **değişmedi** — değişen yalnız açıklama ve hükümdür.

`measurements.girth_cm` kolonu **ham denetim alanı** olarak durur (silinmez);
hiçbir hesap yolunda DBH türetmek için kullanılmaz. Panelin ölçüm CSV
dışa aktarımındaki çevre kolonu `π·DBH` ile **türetilmiş bir kolaylık
alanıdır** — model girdisi değildir ve içe aktarımda çap üretmek için
okunmaz.

**Envanter kalite kapısı (QA v5 · 0033; v4 = 0032; v3 = 0031).** Rapor motoru
yayından önce kayıtları **üç** eksenle denetler (`inventoryQa`,
scripts/make-report.mjs):

| # | Kontrol | Soru | İhlalde |
|---|---|---|---|
| (a) | **Envanter birim kontrolü (DBH)** | DBH bir çap ölçümü olarak teknik açıdan geçerli mi? var → sayısal → > 0 → `1 ≤ D ≤ 400 cm` | ≥3 kayıt VE >%50 → **⛔ kritik** (🔴 BLOKLU) |
| (b) | **Boy/DBH oranı incelemesi** | oran **fiziksel olarak olanaklı** mı (`3 ≤ 100·H/D ≤ 200`) ve **stand içi dağılıma göre aykırı** mı (`modified z > 3,5`)? | **⚠ İNCELEME — asla blok değil** |
| (c) | **Karbon yeniden hesabı** | saklı `carbon_kg`, panel denklemiyle **iki ρ kaynağından herhangi biriyle** ±%20 (ve mutlak fark ≥5 kg) içinde mi? | ≥3 kayıt VE >%50 → **⛔ kritik** (hesap bütünlüğü; DBH birimiyle ilgisi YOK) |

**(b) 0032de neden değişti.** 0031 sabit `15–120` bandını **inceleme ölçütü**
olarak kullanıyordu. Bütünüyle geniş gövdeli (veya bütünüyle bodur) formlu bir
standda sabit bant yanlış bayrak üretir: Göksu (park 25) envanterinde
`100·H/D` aralığı **5,33–16,32** (medyan 9,65 · MAD 1,575) ve **32/34** kayıt
bandın dışındaydı; oysa modified z (Iglewicz–Hoaglin, eşik 3,5) aynı veride
**tek kaydı bile** aykırı bulmaz. QA v4 bu yüzden iki katmanlıdır:

* **fiziksel makullük** — `HD_PHYS_MIN=3`, `HD_PHYS_MAX=200`; ağaç boyu için
  `H_MIN_M=1.3` (göğüs yüksekliği), `H_MAX_M=100` (dünya rekoru ~100 m).
  Bu aralık dışı bir oran/boy, ölçüm veya kayıt hatası olasılığına işaret
  eder → ⚠ (`reason: fiziksel-alt | fiziksel-ust`).
* **stand içi robust aykırılık** — `M = 0,6745·(x − medyan)/MAD`, `|M| > 3,5`
  → ⚠ (`reason: stand-aykiri`). Ortalama/standart sapma yerine **medyan/MAD**
  kullanılmasının nedeni, geniş gövdelerin dağılımın kendisini
  kaydırmasıdır. `n < HD_ROBUST_MIN_N (5)` iken test **koşulmaz**; `MAD = 0`
  ise ortalama mutlak sapmaya düşülür, o da 0 ise test uygulanmaz (sahte
  bayrak üretilmez). Stand dağılımı (`hd_stats`: n, medyan, MAD, min, max,
  z eşiği, `|z|max`) raporda sayıyla beyan edilir.

Tipik `15–120` bandı **yalnız sayım** olarak korunur (`hd_band_out`) ve
raporda “bu bir UYARI DEĞİL, BİLGİDİR” ibaresiyle basılır. `hd_block` kalıcı
olarak `false`tur (0031 hükmü korunur; `test/dbh-qa.test.mjs` kilitler).

**(c) 0032de neden iki ρ kaynağı.** Saklı `carbon_kg` değerlerini üreten 0011
SQL tablosu bazı türlerde **grup varsayılanı** ρ kullanmıştı. QA yalnız **tür
düzeyi** ρ ile karşılaştırınca bu kayıtlar sahte “bant dışı” çıkıyordu
(Göksu: 6/34 kayıt, tümü SALKIM SÖĞÜT; tür ρ=400 ile %27–34, grup ρ=541 ile
%0,0–5,1). QA v4 beklenen değeri **iki kaynakla** hesaplar (`calcRow` tür ρ
ile ve `{rho:{}, grho}` bağlamıyla grup varsayılanı ile); saklı değer
herhangi biriyle bant içindeyse satır **geçerlidir** ve eşleşen kaynak
sayıyla beyan edilir (`dev_rho.tur` / `dev_rho.grup` /
`dev_rho.grup_farkli`, satır düzeyinde `rho_src`). Gerçek hesap hataları
(ör. 10× ondalık kayması) her iki kaynakla da bant dışı kaldığı için
**yakalanmaya devam eder**. Karbon motoru, katsayılar, saklı değerler, CSV
biçimi ve veri tabanı şeması **değişmez** — değişen yalnız denetimin
karşılaştırma ölçütüdür.

**(d) 0033te KALDIRILDI: eşik tabanlı gövde sınıfı beyanı.** 0032, gövde çapı
`100 cm` ve üzerindeki bireyleri sayan ve bir mevzuat künyesiyle birlikte
“ℹ️ BEYAN” satırı olarak basan dördüncü bir kalem içeriyordu. **0033 bu
kalemi, ℹ️ satırını, `metadata.json` alanını ve ilgili eşik sabitini
kaldırdı.** Gerekçe veri sahibinin kararıdır (2026-10-01):

* **Kapsam.** DendroGeo bir ölçüm ve karbon muhasebesi aracıdır; ağaçların
  **yasal statüsü** (tescil, koruma kararı vb.) bu aracın konusu değildir.
  Envanterde tescilli olmayan bireyler bulunabilir ve bir ölçüm raporu
  tespit/tescil hükmü **taşıyamaz**. Bu nedenle rapor, hiçbir birey için
  statü iddiası, sınıf ataması veya mevzuat değerlendirmesi üretmez.
* **Veri değişmedi.** Gövde çapları sahada ölçüldüğü gibi modellenir;
  düzeltme, ölçekleme, dışlama veya çevre→çap dönüşümü **yoktur**.
* **Yerine geçen.** `inventoryQa` çıktısında `dbh_stats` (n, min, medyan,
  max) **yalnız betimleyici** bir özet olarak tutulur; §5.1 “Gövde çapı
  notu” ve §9 “Gövde çapı dağılımı ve model temsili” maddeleri bu aralığı
  sayıyla verir. Eşik, basamak, sınıf veya puan **yoktur**.
* **Tek kaynak.** Kapsam beyanı `scripts/lib/mc.mjs` içinde
  `YASAL_STATU_KAPSAM` sabitidir; rapor §9da ve `metadata.json`
  `scopeNote` alanında **aynı sabiti** kullanır (metin kopyası yoktur).
* **Duruma etkisi yoktu, şimdi hiç yok.** ℹ️ işaretinin `qaStateOf`
  üzerindeki etkisizliği korunur; `qaRow` ℹ️ üretebilme yeteneğini
  **kod düzeyinde** tutar (CSS `.qinfo` tanımı durur), ancak 0033
  şablonunda ℹ️ satırı **basılmaz**.
* **Bekçisi.** `test/form-qa.test.mjs`: yasaklı ifade taraması (rapor HTMLi,
  `metadata.json`, `scripts/*`, `docs/*`) + eşikten bağımsızlık testi
  (99 cm ile 200 cm aynı muameleyi görür).

Yardımcılar `scripts/lib/mc.mjs` içindedir: `medianOf()`, `madOf()`,
`modifiedZ()`, `YASAL_STATU_KAPSAM`.

**Üç hâlli rapor durumu** (`QA_STATE`, scripts/lib/mc.mjs) Çizelge 4ten
türetilir ve künyede + §7 girişinde basılır:

* 🔴 **BLOKLU** — kritik veri hatası (a veya c sistemik): karbon sonucu
  bilimsel iletişimde kullanılmamalıdır.
* 🟡 **İNCELEME** — veri geçerli; bazı istatistiksel kontroller uyarı veriyor.
  Veri hatası hükmü DEĞİLDİR, sonucu geçersiz kılmaz. 0032: inceleme
  kalemlerinin hiçbiri ağaç ölçüm değerleriyle ilgili değilse (ör. yalnız
  `accuracy_m` kaydedilmemiş) rapor bunu açıkça yazar.
* 🟢 **GEÇERLİ** — tüm kritik kontroller geçti.
* ℹ️ **BEYAN** — dördüncü bir **durum değildir**: Çizelge 4 satır işareti.
  Bilgilendirme kalemidir (ör. ρ kaynağı) ve durumu değiştirmez. 0033
  şablonunda ℹ️ satırı basılmaz; §7 girişindeki açıklama cümlesi de
  **yalnız böyle bir satır varsa** üretilir.

**Çizelge 4 sunumu (0032).** §7 tablosu `table.qa` + `<colgroup>`
(`%23 / %16 / %61`) ile **sabit kolon düzeninde** basılır: ayrıntı hücresi
`.qd` (orantılı/sans yazı, `overflow-wrap:break-word` → uzun Türkçe cümle
**kelime ortasından kırılmaz**), sonuç hücresi `.qst` (renkli, ekranda tek
satır; mobil ve printte normal sarma → hücre taşmaz). `.qinfo` (mavi; ⚠ ile
karışmaz) ℹ️ satırları için tanımlıdır; 0033 şablonu böyle bir satır
basmasa da sınıf CSSde durur. Uzun açıklama kolonu olan diğer çizelgeler (§4.6
veri sözlüğü, §10 tekrar üretilebilirlik) aynı `.qd` hücresini kullanır.
Mobilde `.tscroll` kabı yatay kayar (`table.qa{min-width:540px}`), printte
üç kolon korunur. Önceki hâlde ayrıntı kolonu monospace `.76rem` +
`overflow-wrap:anywhere` idi; tablo bu yüzden şekilsiz görünüyordu.

Eşik sabitleri tek yerdedir: `QA_LIMITS` (scripts/lib/mc.mjs) —
`DBH_MIN_CM=1`, `DBH_MAX_CM=400`, `HD_MIN=15`, `HD_MAX=120` (tipik bant,
yalnız sayım), `HD_PHYS_MIN=3`, `HD_PHYS_MAX=200`, `H_MIN_M=1.3`,
`H_MAX_M=100`, `HD_ROBUST_Z=3.5`, `HD_ROBUST_MIN_N=5`, `CARBON_DEV_PCT=20`,
`CARBON_DEV_MIN_KG=5`, `BLOCK_RATIO=0.5`, `BLOCK_MIN_N=3`. 0033: eşik tabanlı
gövde sınıfı sabiti **YOKTUR** (bkz. §1.5.1 (d)).

Aynı kontroller `scripts/import-measurements.mjs` içinde içe aktarımda da
çalışır. **`--birim cevre` kaldırıldı (0031):** araç `auto` kipinde birimi
her zaman **cm** kabul eder, dönüşüm uygulamaz; boy/çap oranı taşmışsa
yalnız uyarı basar. Dosyada çap kolonu yoksa (yalnız çevre kolonu varsa)
içe aktarma **durur** — sessiz ÷π türetmesi yapılmaz. `--birim mm` açık
operatör beyanıdır (mm→cm birim düzeltmesi, π ile ilgisi yoktur).

### 1.6 Geçersiz girdiler

`D ≤ 0`, `H ≤ 0`, `null`, `undefined` veya `NaN` için tüm çıktılar **0** döner;
NaN yayılmaz. Bu davranış `test/allometry.test.mjs` ile kilitlidir.

---

## 2. Konum ve alan matematiği

### 2.1 Mesafe ve kerteriz

`src/utils/geo.js`: haversine (R = 6.371.000 m) ve başlangıç kerterizi.
Kerteriz her zaman `[0, 360)` aralığındadır.

### 2.2 WebMercator

Aynı dosyada `dgLonLatToWebMercator` / `dgWebMercatorToLonLat`:
EPSG:3857, R = 6.378.137 m, enlem ±85.0511287798'e kırpılır. Geçersiz
girdide ileri yön `throw`, ters yön `null` döner.

### 2.3 UTM projeksiyonu (LULC)

`src/services/landcover.js` içindeki `dgLcUtmForward` / `dgLcUtmInverse`,
Snyder seri açılımıyla tam UTM dönüşümüdür:

* elipsoit WGS84: `a = 6378137`, `e² = 0.0066943799901413165`
* ölçek `k0 = 0.9996`, false easting 500.000 m, güney yarımküre +10.000.000 m
* EPSG kodu: kuzey `32600 + bölge`, güney `32700 + bölge`;
  bölge = `floor((lon+180)/6)+1`, 1-60'a kırpılı

Doğrulama (birim test): Ankara (39.9334 N, 32.8597 E) → EPSG:32636'da
E 488.012,4 / N 4.420.374,7 (±2 m). İleri→ters gidiş-dönüş < 1e-5°.

### 2.4 Poligon alanı ve kırpma

* **Jeodezik alan** (`ringGeodesicArea`, gridplan.js): küresel fazlalık
  formülü, R = 6.378.137 m, halka `[lon, lat]` sırasındadır.
* **Düzlem alanı** (`dgLcPlanarArea`, landcover.js): shoelace, UTM metre
  koordinatlarında, halka `{x, y}` nesneleridir.
* **Kırpma** (`dgLcClipPolygonRect`): Sutherland-Hodgman, dört kenar için
  `inside`/`intersect` closure'larıyla. Kesişim alanı = kırpılan poligonun
  düzlem alanı; delikler çıkarılır ve sonuç `max(0, …)` ile kırpılır.

⚠️ **Koordinat sırası sözleşmesi (karmaşaya açık, testlerle kilitli):**

| Fonksiyon | Halka sırası |
|---|---|
| `ringGeodesicArea`, `polyArea` (gridplan.js) | `[LON, LAT]` |
| `pointInPolygon`, `pointInPark` (gridplan.js) | `[LAT, LON]` |
| `dgLcProjectGeometry` (landcover.js) | `[LAT, LON]` → `{x, y}` |

### 2.5 Arazi örtüsü (LULC) alan hesabı

> **Otorite belge:** [`LULC_METHODOLOGY.md`](LULC_METHODOLOGY.md)
> Bu bölüm yalnızca özetler; çelişki olursa LULC_METHODOLOGY.md geçerlidir.

**v4 (2026-09-20) itibaren çift kaynak:** birincil **ESA WorldCover 2021 v200**
(10 m, 11 sınıf, EPSG:4326), çapraz doğrulama **IO LULC 2020** (10 m, UTM).
Grup başına uzlaşma yüzdesi belirsizlik göstergesi olarak raporlanır.

Özet yöntem: park poligonu analiz UTM'sine projekte edilir; rasterin **gerçek
kaynak hücreleriyle** kesişimi alınır. UTM karolarda hücre dikdörtgen,
EPSG:4326 karolarda hücrenin derece köşeleri UTM'ye projekte edilip **tam
dışbükey kesişim** hesaplanır (anizotropik ~7,1×9,3 m hücre şekli korunur).
Alanlar hücre sayımıyla değil gerçek kesişim geometrisiyle üretilir; hücre
toplamı park alanına %0,5 QA eşiği içinde eşittir. Ayrıca 4-yön bağlantılı
bileşen analiziyle **nesneler** (su kütlesi, yeşil blok, yapılı parça)
tanımlanır: nesne başına alan + alan-ağırlıklı merkez.

Doğrulama örneği (canlı veri, `scripts/lulc-qa.mjs`): Göksu Parkı 50.05 ha →
su 12.50 ha, sert 14.71 ha, yeşil 22.26 ha; QA farkı %0.000; saha bilgisiyle
(su ~12,5 ha, sert ~15 ha) uyumlu.

---

## 3. Çevrimdışı mimari ve önbellek

* Ölçümler + fotoğraf blob'ları IndexedDB'de kuyruklanır; her kayıt
  **UUID (`client_id`)** taşır ve sunucu tarafında duplicate koruması sağlar.
* `sw.js` iki statik cache kullanır: **PRECACHE** (install'da yazılır, asla
  trim edilmez — çevrimdışı yedeğin kendisi) ve **RUNTIME** (`?v=` sürümlü
  çalışma zamanı kopyaları, `MAX_RUNTIME=400`).
* Uygulama JS/CSS **network-first** yüklenir; ağ yoksa RUNTIME'a, orada da
  yoksa PRECACHE'teki sorgusuz kopyaya düşülür. Bu yüzden sürüm numaralarını
  elle artırmak zorunlu değildir.
* `?v=` değerleri `scripts/version-sync.mjs` tarafından **içerik hash'inden**
  üretilir; CI tutarlılığı denetler.

---

## 4. Bilinen sınırlılıklar

Bunlar hata değil, **belgelenmiş varsayımlardır**. Değiştirmek isteyen
önce ilgili birim testi güncellemelidir.

1. **Chave 2014 pantropikal bir denklemdir.** Tür listesi ağırlıklı olarak
   ılıman/Türkiye florasıdır; ılıman iğne yapraklılar için sistemli sapma
   olabilir. Bölgesel denklem (örn. Türkiye allometrisi) değerlendirmesi açık.
2. **Uygulama arayüzü tek nokta tahmini verir; yayımlanan DGR raporları
   Monte Carlo %95 güven aralığı taşır.** AGB denkleminin RSE'si ~%19-29'dur.
   Rapor hattı (`scripts/lib/mc.mjs`) bu belirsizliği yayımlanan park
   raporlarında iletir: N=1000 örneklem, sabit seed (20260926 → aynı veri aynı
   aralığı üretir, hakem tekrarı mümkün); girdi hatası `D ~ N(D; 0,5 cm)`,
   `H ~ N(H; 0,25 m)`; model hatası çarpan `(1 + z·CV)`, `CV = 0,22` ve
   kayıtlar arasında **koreledir** (aynı denklem ortak sapma üretir →
   bağımsızlık varsayımının yapay daralttığı aralıklardan kaçınılır).
   Panel/harita/dışa aktarım sayıları belirsizlik eki olmadan tek nokta
   tahmini olarak kalır.
3. **ρ tablosu eksik** (panel listesinde 28/50 tür ρ'sız — 0011e: 45
   orijinal + Göksu'nun kaynaklı 5 türü). Grup varsayılanı kullanılır;
   kaynaklandırılamayan türe değer UYDURULMAZ.
4. **Kök oranı (0,26) ve karbon oranı (0,47) sabittir.**
5. **Gövde form faktörü (0,5) sabittir.**
6. **Boy ölçülemeyen ağaç veri setine giremez** (`H` zorunlu). Chave'ın boy
   gerektirmeyen varyantı (`AGB = exp(-1.803 - 0.976·E + 0.976·ln(ρ·D²))`)
   yol haritasındadır.
7. **İstemci tarafı `.limit()` eşikleri** vardır (2.000-5.000). Eşik
   aşılırsa arayüz **uyarır** (`src/utils/truncation.js`), ama yayınlanan
   toplamlar yine de kesilmiş kümeye dayanır. Kalıcı çözüm `v_world_agg`
   view'ı + bbox sayfalama.

---

## 5. Sürümleme

* Kod sürümü: git etiketleri + `sw.js` içindeki `CACHE_VERSION` (içerik
  değişince artar; bkz. `test/user-publish.test.mjs` sözleşmesi).
* Yöntem sürümü: **bugün yok.** ρ tablosu ya da denklemler değiştiğinde eski
  kayıtların hangi yöntemle hesaplandığı izlenemiyor. `allometry_version` /
  `rho_used` sütunları yol haritasındadır; gelene dek bu belge yöntemin
  *mevcut* halini tanımlar.
