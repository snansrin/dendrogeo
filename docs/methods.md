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

Tür bazlı değerler tabloda listelenir (örn. Kızılçam 478, Meşe 570).
**45 tür kaydının 28'inde ρ yoktur** ve grup varsayılanına düşer. ρ, AGB'ye
doğrusal girdiği için %20 ρ hatası ≈ %20 karbon hatası demektir — bu, veri
setinin en büyük belirsizlik kaynağıdır.

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
2. **Belirsizlik yayılımı yoktur.** AGB denkleminin RSE'si ~%19-29'dur;
   raporlar bugün tek nokta değeri verir, güven aralığı vermez.
3. **ρ tablosu eksik** (28/45 tür). Grup varsayılanı kullanılır.
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

* Kod sürümü: git etiketleri + `sw.js` içindeki `CACHE_VERSION` (`r34`).
* Yöntem sürümü: **bugün yok.** ρ tablosu ya da denklemler değiştiğinde eski
  kayıtların hangi yöntemle hesaplandığı izlenemiyor. `allometry_version` /
  `rho_used` sütunları yol haritasındadır; gelene dek bu belge yöntemin
  *mevcut* halini tanımlar.
