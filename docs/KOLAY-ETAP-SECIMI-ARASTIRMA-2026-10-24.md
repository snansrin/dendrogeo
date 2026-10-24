# Kolay etap seçimi: araştırma ve uygulama

Kullanıcı tam çevre çizimini zahmetli buldu; otomatik öneri, iki sınır arasında
alan alma ve üst Araçlar menüsü istedi. Bu değişiklik analiz motorunu yeniden
bölmez; mevcut park geometrisinden yeni çalışma kapsamı önizlemesi üretir.

## Araştırma kararı

- [ABB listesi](https://www.ankara.bel.tr/tr/duyurular/baskent-parklarinda-spor-basliyor-57)
  Dikmen'de 1–2 ve 3. etap adlarını ayrı anıyor. Ad listesi vektör sınır sağlamaz.
  [Kültür Portalı](https://www.kulturportali.gov.tr/turkiye/ankara/gezilecekyer/dkmen-vads)
  1–2. etabı birlikte anlatır; tarihî toplam alan yeni bir kesim çizgisi değildir.
- [ABB'nin plan paftası](https://s.ankara.bel.tr/files/9215/0537/2397/5000_snrl_en_son.pdf)
  son etap kentsel dönüşüm/imar kapsamını içerir. Bu kapsam otomatik park etap
  geometrisi olarak kullanılamaz; konut/imar sınırı park sınırından farklıdır.
- OSM multipolygon üyeleri etap sayısı değildir. [OSM modeli ve halka kuralları](https://wiki.openstreetmap.org/wiki/Relation:multipolygon/Algorithm)
  kapalı dış/iç halkaları birleştirir. 24 Ekim'de bilinen Dikmen relation'ı bir
  kez doğrudan kamu API'sinden alındı: `relation/14290362`, sürüm 4, tek dış halka,
  318 node referansı. Fixture yalnız geometri ve kaynak künyesini içerir;
  katkıcı kişi/uid bilgileri saklanmadı. Lisans ODbL-1.0, OpenStreetMap katkıcı atfı.
- [GeoJSON RFC 7946](https://www.rfc-editor.org/rfc/rfc7946.html) ve mevcut
  [polygon-clipping](https://github.com/mfogel/polygon-clipping) kütüphanesiyle
  kesişim, boşluk ve ayrı parçalar korunabilir. Yeni ağ servisi veya görüntüden
  tahmin yapan bir sınıflandırıcı eklemeye gerek yoktur.

Doğrulanmış resmî etap poligonu elde edilmediği için resmî otomatik etap tespiti
iddiası yapılmaz. Kullanıcıya gerçek park sınırından **otomatik bölüm önerileri**
ve iki dokunuşla **iki kesit arasındaki alanı alma** verilir; onay açıkça istenir.

## Kullanım

1. Park algılandıktan sonra üst menüde **🧩 Etaplar → Yeni etap oluştur**.
2. **Otomatik bölüm öner:** ayrık park alanları varsa bunları ayrı seçenek yapar.
   Tek bağlı alanda kullanıcının seçtiği 2/3/4 geometrik bölüm önerisi çıkarır.
   Hiçbir bölüm kendiliğinden seçilmez. Haritadan veya listeden seçilen öneri
   önizlenir; gerçek alanı ha olarak görünür.
3. **Başlangıç ve bitiş çizgilerini ayarla:** soldaki sabit panelden başlangıç
   ve bitiş sınırları ayrı ayrı yerleştirilir. Her sınır için köprü doğrultusunda
   iki nokta seçilir. Dört referans ayrı ayrı sürüklenebilir; çizgiler paralel
   olmaya zorlanmaz. Bir sınırı yeniden seçmek diğerini korur. İki çizginin
   arasındaki bölge gerçek park sınırıyla kesiştirilir; çevre çizilmez.
4. Sol panelde isim girip **Etap olarak kaydet**. Menü üzerinden öneri seçildiyse
   **Ad ver ve kaydet** ile isim alanına dönülür. Önizleme kayda/analize
   kendiliğinden geçmez. Kayıttan sonra ad ana park adıyla birlikte gösterilir.
5. Eski serbest çizim yalnız **Gelişmiş** altında isteğe bağlı kalır.
   Kayıtlı etap seçimi aynı üst menüdedir. İptal/Escape seçimi kaldırır.

## Geometri sözleşmesi

Kayıtlı etabın başlangıç/bitişini çok noktalı düzenlemek için
[Etap düzenleme kılavuzu](ETAP-SINIR-DUZENLEME-2026-10-25.md) kullanılır.

- Ayrık parçalar, dış halkaların birleşiminden boşluklar çıkarıldıktan sonra
  bağlı bileşenler olarak bulunur. Sayıları resmî etap sayısı diye sunulmaz.
- Tek parça önerileri sınırın yerel ölçekli koordinatlarında hesaplanan ana
  doğrultu boyunca eşit **uzunluk aralıklarıdır**; eşit alan veya resmî etap
  garantisi değildir. Bu hesap yalnız seçim yönü içindir. Bilimsel alan, raster,
  QA ve karbon hesapları mevcut motorlarda değişmeden devam eder.
- Maskeler geçici kesme araçlarıdır. Son geometri yalnız gerçek parkla
  kesişimdir; bbox/konveks zarf park alanı olmaz. Boşluk, konkav kenar ve ayrık
  parçalar korunur. Kaynak sınırındaki köşeler yeniden çizdirilmez.
- Her çizginin iki referansı en az 2 m ayrı olmalı. Başlangıç/bitiş çizgileri
  parkın içinde kesişiyorsa belirsiz bir dilim seçmek yerine düzeltme istenir.
  Boş kesişim reddedilir. Aynı kesit arasında
  parkın birden fazla parçası kalırsa tamamı önizlenir; parça sessizce atılmaz.
- Ağır geometri ve kayıt boyunca seçim denetimleri/işaretler kilitlenir.
  Bekleyen eski hesap, yeni parkın veya yeni işaretlerin önizlemesini değiştiremez.
- Onay anındaki geometri sabitlenir; kullanıcı kaydı beklerken işareti oynatıp
  onaylanandan farklı sınırı kaydettiremez. Geçiş/taslak korumaları sürer.

## Korunanlar ve doğrulama

Yeni tablo, kolon, RPC veya migration yoktur. Önceki etap kayıt API'si ve kesin
etap konum çiti kullanılır. Eski ölçümler, kabul edilmiş analizler, raster,
allometri, tür/yoğunluk, PNG renk paleti ve raporlar değiştirilmez.

`park-stage-cut.test.mjs`: gerçek Dikmen sınırı, 2/3/4 bölümlerin birleşiminin
orijinal alanla eşitliği, örtüşmeme, delik/konkav kenar/ayrık parça, iki noktanın
ters sırası, geçersiz/çok yakın noktalar ve mevcut kayıt halka limitleri.
`park-stage-assisted-ui.test.mjs`: geç gelen önizleme, iptal temizliği, harita
durumunun geri verilmesi, işaret kilidi, üst menü/host kimliği ve haritayı
kapatmayan durum çubuğu. Telefon testleri gerçek tıklama, salt okunur önizleme,
tema/taşma/erişilebilirlik, kayıt ve mevcut serbest çizim/PNG akışını denetler.
