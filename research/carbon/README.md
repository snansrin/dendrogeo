# Bağımsız karbon doğrulaması ve saha araştırması

Bu araçlar üretim analizinden ayrıdır: ağ isteği, veritabanı yazması, kayıt güncellemesi veya model seçimi yapmaz. Saha çevresi, boy, tür, yoğunluk ve katsayılar değişmez. Üretilen tanı çıktıları DGR sonuçlarının yerine yazılmaz.

## 1. Bağımsız referans hesap

```sh
node scripts/check-carbon-reference.mjs
python -m unittest discover -s research/tests -v
```

Gerekirse `DG_PYTHON` değişkenine Python 3 çalıştırılabilir dosyasını verin. İkinci uygulama Python standart kitaplığıyla yazılmıştır; JavaScript hesaplama fonksiyonlarını çağırmaz. `density-policy-v1.json`, mevcut kilidin 16 özel tür yoğunluğu, iki grup değeri ve 49 tür/grup eşlemesinin dondurulmuş referans kopyasıdır. Otomatik olarak güncellenmez.

147 sentetik vektör (49 tür × üç çevre/boy çifti), Python çıktısı, önceden kaydedilmiş sayısal referans, gerçek tarayıcı use-case'i ve rapor hesaplayıcısı arasında karşılaştırılır. Tolerans `|fark| / max(1, |referans|) ≤ 10⁻¹²` olur. Bu birim, çevre–çap dönüşümü, yoğunluk seçimi ve aritmetik regresyon kontrolüdür; bağımsız saha veya yerel biyokütle doğrulaması değildir.

## 2. Saha bilgileri nerede girilir?

Rapor yayımlama formunda **Saha doğrulama bilgileri (isteğe bağlı)** bölümünü açın. Envanter kapsamı, ekip/gözlemci, cihaz kontrolü ve tekrar ölçüm beyanı eklenebilir. Mevcut **Ek bilgiler** bölümünde örnekleme tasarımı, cihaz/yöntem ve tarihler bulunur. Bütün alanlar isteğe bağlıdır; boş alanlar `unknown`/belirtilmedi olarak açıklanır. Mevcut paylaşım onayı ve erişim kuralları korunur.

- **Kapsam:** Tam sayım, kısmi envanter veya olasılıklı örnekleme; hedef alan/tür/boy sınıfları, erişilemeyen alanlar, seçim yöntemi, çalışma tarihi ve saha eforu.
- **Cihaz:** Gerçekten kullanılan çevre mezurası, boy ölçme yöntemi/cihazı, konum yöntemi ve biliniyorsa marka/model. Örnek metin gerçek cihaz beyanı değildir.
- **Kontrol/kalibrasyon:** Tarih, referans, kontrol aralığı, sapma ve yapılan işlem. Kalibrasyon yapılmadıysa bunu belirtin; bu alan katsayıları değiştirmez.
- **Tekrar ölçüm:** Aynı ağaç kimliği, ilk/tekrar tarihleri, gözlemci, ham çevre/boy ve bağımsızlık. Büyüme ile ölçüm tekrarlanabilirliğini ayırın; tekrar satırını yeni ağaç gibi toplamayın.

GBIF alan eşlemesi: `sampling` → `samplingProtocol` ve beyan edilen efor; saha tarihleri → `eventDate`; `observers` → `recordedBy`; kapsam/kalibrasyon/tekrar ölçüm → yöntem açıklaması. Serbest metinlerin bulunması otomatik GBIF uygunluğu sağlamaz. [GBIF survey rehberi](https://docs.gbif.org/guide-publishing-survey-data/en/).

Yeni DGR HTML ve `metadata.json` çıktısı saha beyanlarını ve dört belirsizlik kaynağının kapsamını gösterir. Mevcut yayımlanmış raporlar yeniden üretilmez veya değiştirilmez.

## 3. Ayrı belirsizlik tanısı

```sh
python research/carbon/uncertainty.py < my-input.json > my-diagnostic.json
```

Girdi örneği (yalnız sentetik gösterim):

```json
{"rows":[{"id":"synthetic-1","species":"KARAÇAM","grp":"İBRELİ","girth_cm":100,"height_m":12}],"settings":{"girth_sd_cm":0.5,"height_sd_m":0.25,"model_cv":0.22}}
```

Çıktıda ölçüm, yoğunluk, model ve örnekleme ayrı kalır. İlk mertebe duyarlılık hesabı, mevcut Monte Carlo aralığının yerini almaz. Çevre ve boy hataları bağımsız; model çarpanı bütün ağaçlar için ortaktır. Varsayılan SD/CV değerleri mevcut üretim varsayımlarını betimler; cihaz kalibrasyonu değildir.

Yoğunluk için güvenilir bir CV yoksa bileşen **hesaplanmadı** olur; sıfır belirsizlik sayılmaz. Bir araştırma senaryosu için `density_cv` ve açıkça `density_correlation: "independent"` veya `"shared"` verilebilir. Bu, kilitli yoğunlukların değiştirilmesi değildir. Bağlam dışı bir CV yerel veriyle ölçülmüş gibi sunulmamalıdır.

Örnekleme varsayılan olarak hesaplanmaz. Yalnız bilinen bir çerçeveden, eşit olasılıklı, tam yanıtlı, yerine koymadan basit rastgele **bireysel ağaç** örneklemesi için:

```json
{"sampling_design":{"type":"srs_without_replacement","unit":"tree","population_size":1000,"equal_probability":true,"complete_response":true,"sampling_frame":"Gerçek örnekleme çerçevesinin kimliği / kaynağı"}}
```

Bu nesne `rows` ile aynı girdiye eklenir. Benzersiz ağaç kimlikleri ve en az iki ağaç gereklidir. Çerçeve toplamı `N × örnek ortalaması`; tasarım varyansı `N² × (1 − n/N) × s²/n` olur. Kolayda örnekleme, waypointte erişilen ağaçlar, kümeli/tabakalı tasarımlar veya eksik yanıt için bu hesap kullanılamaz. Araç tasarım beyanının gerçekte doğru olduğunu doğrulayamaz.

Ölçüm/model tanısının hedefi kayıtlı ağaç toplamı, örnekleme bileşeninin hedefi belirtilen çerçeve toplamıdır. Farklı hedefler tek varyans veya yeni güven aralığına birleştirilmez. [IPCC 2019 belirsizlik rehberi](https://www.ipcc-nggip.iges.or.jp/public/2019rf/pdf/1_Volume1/19R_V1_Ch03_Uncertainties.pdf).

## 4. Tekrar ölçüm değerlendirmesi

```sh
python research/carbon/validation.py < my-repeat-measurements.json > my-repeat-results.json
```

`templates/repeat-measurements.json` gerçek veriyle doldurulur. Her ağaç yalnız bir eşleştirilmiş çift oluşturur. Çevre ve boy için ortalama fark (tekrar − ilk), MAE, RMSE ve `sqrt(Σfark²/(2n))` teknik ölçüm hatası verilir. Tarih, gözlemci bağımsızlığı ve cihaz koşulları olmadan bu sayılar kalibrasyon veya uzun dönem büyüme kanıtı değildir.

## 5. Yerel kent ağacı uygunluğu

```sh
python research/carbon/validation.py < my-independent-agb.json > my-local-results.json
```

`templates/local-agb.json` gerçek bağımsız referansla doldurulur. Referans, **kg fırın-kuru toprak üstü biyokütle** olmalıdır; taze kütle, toplam biyokütle veya karbon değildir. Ölçülmüş kuru AGB ile bağımsız yapısal tahmin ayrı gruplarda raporlanır. Aynı denklemin başka yazılımdaki çıktısı biyolojik referans olarak kabul edilmez.

Araç bias, MAE ve RMSE verir; otomatik “yerel olarak doğrulandı” kararı vermez, katsayı uydurmaz ve alternatif denklemi üretime geçirmez. Eşleştirme bağımsızlığı kullanıcı beyanıdır. Referansın kendi belirsizliği, tür/boyut kapsamı, budama/yetişme koşulları ve seçilme olasılıkları ayrıca incelenmelidir. [Chave ve ark. 2014](https://doi.org/10.1111/gcb.12629) tropikal ağaç biyokütlesi modelidir; yerel kent ağacı uygunluğu ayrıca kanıtlanmalıdır.

### Uygulama durumu

| Hedef | Durum | Gerekli gerçek kanıt |
|---|---|---|
| Tür/yoğunluk/formülün korunması | Hash ve 147 referans vektörüyle kontrol | Yeni katsayı uygulanmadı |
| İsteğe bağlı saha metadatası | Form, künye, HTML ve makine okunur açıklama | Araştırmacının gerçek beyanı |
| Dört belirsizlik kaynağının ayrılması | Açıklama ve ayrı çevrimdışı tanı | Kalibrasyon/yoğunluk/tasarım bilgisi |
| Tekrar ölçüm değerlendirmesi | Çift eşleştirme ve metrik aracı | Gerçek tekrar ölçümleri |
| Yerel allometri değerlendirmesi | Bağımsız referans ve grup metrik aracı | Gerçek bağımsız biyokütle referansı |

Araçların hazır olması saha çalışmasının yapılmış olduğu anlamına gelmez. Son iki çalışmanın veri gereksinimi yazılım tarafından doldurulmaz.
