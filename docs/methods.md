# Yöntem

Bu belge DendroGeo'nun ürettiği her sayının nasıl hesaplandığını, hangi
sabiti nereden aldığını ve bilinen sınırlılıklarını açıklar. Amaç: bir
okuyucunun repoyu açmadan sonuçları yeniden üretebilmesi.

---

## 1. Biyokütle ve karbon

### 1.1 Toprak üstü biyokütle (AGB)

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

Güncel hesapta tek ve değiştirilemez otorite `src/config/wood-density-lock.js` içindeki
`DG-WD-LOCK-2026-10-06-FINAL` yoğunluk kilididir. Kilitli yükün SHA-256 parmak izi
`1312379570ccf39d4ca6a3dbd7eb3fef0ba894dd12d34cfe87ee39cb0ab480cc` değeridir. Uygulama içinde birim
**kg/m³** tutulur; kaynak tablodaki ton/m³ değerleri ×1000 çevrilir.

| Grup / tür | ρ (ton/m³) | ρ (kg/m³) | Kaynak |
|---|---:|---:|---|
| İbreliler (Genel) | 0,446 | 446 | Tolunay, 2013; NIR Turkey, 2017; 299 Nolu Tebliğ, 2017 |
| Abies sp. (Göknar) | 0,350 | 350 | As ve ark., 2001 |
| Cedrus deodora (Himalaya Sediri) | 0,430 | 430 | Bozkurt ve Erdin (2000), Demetçi (1986) |
| Cedrus libani (Toros Sediri) | 0,430 | 430 | As ve ark., 2001 |
| Juniperus sp. (Ardıç) | 0,460 | 460 | As ve ark., 2001 |
| Picea orientalis (Doğu Ladini) | 0,358 | 358 | As ve ark., 2001 |
| Pinus brutia (Kızılçam) | 0,478 | 478 | As ve ark., 2001 |
| Pinus halepensis (Halep Çamı) | 0,480 | 480 | Erten ve Sözen, 1997b |
| Pinus nigra (Karaçam) | 0,470 | 470 | As ve ark., 2001 |
| Pinus pinea (Fıstık Çamı) | 0,470 | 470 | Erten ve Sözen, 1997a |
| Pinus sylvestris (Sarıçam) | 0,426 | 426 | As ve ark., 2001 |
| Yapraklılar (Genel) | 0,541 | 541 | Tolunay, 2013; NIR Turkey, 2017; 299 Nolu Tebliğ, 2017 |
| Alnus sp. (Kızılağaç) | 0,407 | 407 | As ve ark., 2001 |
| Carpinus sp. (Gürgen) | 0,630 | 630 | IPCC, 2003 |
| Fagus orientalis (Doğu Kayını) | 0,530 | 530 | As ve ark., 2001 |
| Fraxinus excelsior (Dişbudak) | 0,562 | 562 | Gürsu, 1971 |
| Populus sp. (Kavak) | 0,350 | 350 | IPCC, 2003 |
| Quercus sp. (Meşe) | 0,570 | 570 | As ve ark., 2001 |

**Sığla kuralı.** `SIĞLA`, `Sığla`, `SIGLA` ve
`Liquidambar orientalis` aynı kanonik türe çözülür; ancak **özel ρ değeri
taşımaz**. Sığla bir yapraklı tür olarak **YAPRAKLI genel 0,541 ton/m³
(541 kg/m³)** değerini kullanır. DBH 57 cm ve H 7,5 m için mevcut denklem
yaklaşık **418,42 kg C** üretir. Bu saha örneği regresyon testiyle kilitlidir.

Aktif ölçüm kataloğunda **49** tür vardır; **16** tür kilitli özel ρ taşır,
**33/49** tür özel ρ taşımadığı için yalnız kendi grup genelini kullanır.
Ölçüm grubu yalnız **İBRELİ** veya **YAPRAKLI** olabilir. `DİĞER`,
bilinmeyen tür veya katalogla uyuşmayan grup için karbon hesabı üretilmez.

Yeni tür yalnız `src/config/species.js` içine İBRELİ veya YAPRAKLI grubunda
`rho:null` olarak eklenebilir. Yeni türe özel ρ eklemek, mevcut yoğunluğu
değiştirmek, üçüncü bir grup/fallback tanımlamak veya tarihsel ρ'yı yeniden
hesap yoluna sokmak CI kilidini bozar. Eski migration ve geri çekilmiş rapor
dosyalarındaki tarihsel değerler yalnız arşiv kanıtıdır; güncel hesap kaynağı
değildir. Panel, rapor QA, Monte Carlo ve CSV içe aktarma aynı tek politikayı
kullanır.

**Eşanlamlı çözümleyici.** Saha kayıtları/cihaz çıktıları kanonik ad dışında
yazım üretebilir ("Ağlayan Söğüt", "Cınar", "CEVIZ"). `resolveSpeciesName()`
Türkçe-duyarlı normalizasyon + `SPECIES_SYNONYMS` ile adı kanonik forma
indirger; DB'ye her zaman kanonik ad yazılır. Rapor QA'sı ("Tür sözlüğü
eşleşmesi" satırı) eşleşmeyen adları SAYIYLA beyan eder.

### 1.5.1 Saha çevresi, türetilmiş DBH ve envanter kalite kapısı

**FINAL saha ölçüm protokolü (DG-MEASURE-LOCK-2026-10-06-FINAL).**
DendroGeo sahasında doğrudan çap ölçülmez. Esnek mezura, ağacın yerden
**1,30 m** yüksekliğinde gövdenin etrafına sarılır ve **göğüs çevresi C**
santimetre (cm) cinsinden ölçülür.

Veri modeli iki değeri ayrı tutar:

- **measurements.girth_cm** — sahada gözlenen ham göğüs çevresi C (cm).
- **measurements.dbh_cm** — matematiksel olarak türetilmiş DBH çapı D (cm).

Türeyiş tek ve değiştirilemezdir:

**D = C / π**

Allometri, hacim, boy/DBH oranı, QA ve raporlar yalnız **D** değerini kullanır.
Ham çevrenin doğrudan çap gibi modele verilmesi yasaktır. Saha çevresi hiçbir
zaman kaybedilmez; girth_cm alanında korunur ve rapor/CSV çıktısında
dbh_cm ile birlikte yayımlanır.

Ölçüm protokolü src/config/measurement-protocol-lock.js içinde salt-okunur
kilit olarak tanımlıdır. Kilit kimliği
**DG-MEASURE-LOCK-2026-10-06-FINAL**, parmak izi
**4e48cf360622b5633e664618a8626756b3207cec8dd63a3158714e957eae3212**'dir.
CI; alan semantiğini, dönüşümü, kilit kimliğini, parmak izini ve örnek
hesapları doğrular.

**2026-10-06 düzeltmesi.** Önceki DendroGeo sürümü, sahada mezurayla ölçülen
çevre değerlerini yanlışlıkla DBH çapı olarak modele vermişti. Bu nedenle
biyokütle, karbon ve hacim değerleri sistematik olarak yüksek hesaplanmıştı.
Düzeltmede ham saha sayıları değiştirilmemiştir: eski değer
**girth_cm = eski dbh_cm** olarak korunmuş, gerçek DBH
**dbh_cm = girth_cm / π** şeklinde yeniden türetilmiş; karbon ve hacim bu
türetilmiş çapla yeniden hesaplanmıştır. Bu yöntem değişikliği raporlarda
açıkça beyan edilir; eski yayımlanmış sonuçlar yeni yöntem sonucu gibi
sessizce yeniden etiketlenmez.

**Allometrik zincir:**

1. Göğüs çevresi: C [cm]
2. Türetilmiş DBH: D=C/π [cm]
3. AGB: 0.0673(ρD²H)^0.976
4. BGB: 0.26·AGB
5. Karbon: 0.47·(AGB+BGB)
6. Gövde hacmi göstergesi: π(D/200)²H·0.5

Burada ρ, yalnız kilitli odun yoğunluğu tablosundan; H, metre
cinsinden ağaç boyundan gelir.

**Örnek regresyon — Sığla.** Sahada **57 cm çevre**, **7,5 m boy** ölçülen
Sığla için Yapraklı genel yoğunluğu **541 kg/m³** kullanılır:

- ham çevre C = 57 cm,
- türetilmiş DBH D = 57/π = 18,1437 cm,
- tahmini karbon ≈ **44,79 kg C**.

Bu örnek CI regresyon testinde kilitlidir; 57 cm'nin doğrudan çap sayılmasıyla
elde edilen eski ≈418 kg C sonucu artık saha ölçüm yolu için geçerli değildir.

**Envanter kalite kapısı.** Rapor motoru yayın öncesinde üç temel ekseni
denetler:

| # | Kontrol | Soru | İhlalde |
|---|---|---|---|
| (a) | **Ölçüm protokolü** | Ham çevre var mı ve türetilmiş DBH D=C/π ile uyumlu mu; 1 ≤ D ≤ 400 cm mi? | Sistemik ihlal → **⛔ kritik** |
| (b) | **Boy/DBH oranı** | 100·H/D fiziksel makullük ve stand-içi robust aykırılık açısından uygun mu? | **⚠ İnceleme**, tek başına blok değil |
| (c) | **Karbon yeniden hesabı** | Saklı carbon_kg, türetilmiş DBH + kilitli ρ ile yeniden hesaplanan sonuçla uyumlu mu? | Sistemik ihlal → **⛔ kritik** |

Boy/DBH için HD_MIN=15, HD_MAX=120 yalnız betimleyici tipik banttır.
Fiziksel inceleme HD_PHYS_MIN=3, HD_PHYS_MAX=200; stand içi robust
kontrol |modified z| > 3,5 ve en az beş kayıt koşuluyla uygulanır.
DBH teknik sınırı 1–400 cm, boy sınırı 1,3–100 m'dir.

DendroGeo hiçbir bireyin yasal statüsü (tescil, koruma kararı vb.) hakkında
hüküm üretmez. Gövde ölçüleri yalnız saha ölçümü, matematiksel dönüşüm ve
karbon muhasebesi bağlamında kullanılır.

Aynı protokol scripts/import-measurements.mjs için de zorunludur.
İçe aktarmada ham girth_cm / çevre kolonu gerekir; DBH verilmişse
çevre/π sonucu ile çapraz doğrulanır. --birim mm yalnız çevreyi
mm'den cm'ye dönüştürür; ardından yine DBH = çevre/π uygulanır.


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

**Ham yıllık raster sonucu:** birincil **ESA WorldCover 2021 v200**
(10 m, 11 sınıf, EPSG:4326). **IO LULC 2020** (10 m, UTM), yalnızca
karşılaştırma çalıştırıldığında bağımsız çapraz kontrol sağlar; her raporda
çalıştırıldığı varsayılmaz. Güncel yüzey incelemesinde **Sentinel‑2 L2A**
görüntülerinin 10 m ve 20 m bantlarından spektral kanıt alınabilir. Kullanılan
sahnelerin tarihleri kabul edilmiş analiz kaydında bulunur.

Ham raster sonucu ile **kullanıcının kabul ettiği son yüzey sonucu** ayrı
çıktılardır. OSM bina, su ve sert zemin geometrileri ile kullanıcı çizimleri
etkinleştirilip kabul edildiğinde son yüzey sınıflarına katılır; ham raster
sınıflarını değiştirmez. Her rapor, ilgili analizde kullanılan kaynakları,
dönemi, çözünürlüğü ve kabul edilmiş geometrileri beyan etmelidir.

Ham raster alanı için park poligonu analiz UTM'sine projekte edilir; rasterin
**gerçek kaynak hücreleriyle** kesişimi alınır. UTM karolarda hücre dikdörtgen,
EPSG:4326 karolarda hücrenin derece köşeleri UTM'ye projekte edilip **tam
dışbükey kesişim** hesaplanır (anizotropik ~7,1×9,3 m hücre şekli korunur).
Alanlar hücre sayımıyla değil gerçek kesişim geometrisiyle üretilir; hücre
toplamı park alanına %0,5 QA eşiği içinde eşittir. Ayrıca 4-yön bağlantılı
bileşen analiziyle **nesneler** (su kütlesi, yeşil blok, yapılı parça)
tanımlanır: nesne başına alan + alan-ağırlıklı merkez.

Vektör düzeltmeleri kabul edilmişse ilgili geometriler park sınırı içinde
kırpılır ve örtüşme önceliği kayıtlı düzenleme kuralına göre çözülür; bu
sonuç ham raster alanından ayrı raporlanır.

Tarihsel doğrulama örneği (2026-09-20, `scripts/lulc-qa.mjs`): Göksu Parkı 50.05 ha →
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
3. **ρ tablosu nihai ve kilitlidir:** 49 ölçüm türünün 33/49'u özel tür ρ'su taşımaz ve yalnız kendi grup genelini kullanır. Yeni tür yalnız İBRELİ/YAPRAKLI olarak eklenebilir; DİĞER yoğunluk/fallback yoktur. Sığla YAPRAKLI genel 541 kg/m³ kullanır.
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

