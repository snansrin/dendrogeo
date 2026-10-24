# Etap ayrımı — çevrimdışı geliştirme, 24 Ekim 2026

Bu ilk geliştirme uygulamaya yüklenmez. Ana dal, analiz motoru, arayüz, allometri,
ham raster, mevcut park geometrileri ve kayıt tabloları değiştirilmemiştir.
`feat/park-stage-scope-20261024` dalında Aşama 0 ve seçim sözleşmesi çalışılmaktadır.
Bu dizindeki Node araştırma modülleri üretim modülü veya tamamlanmış etap özelliği değildir.

## Çalışan parçalar

- `osm-topology.mjs`: relation üyelerini node kimliği üzerinden birleştirir;
  sıra/yön bağımsızdır. Eksik üye, bilinmeyen rol, tekrar, açık veya belirsiz
  zincir için kısmi sonuç döndürmez. Halkaları dış/iç rolleriyle korur. Koordinat
  bulunmadığından öz kesişim, delik kapsaması ve iç ada yerleşimini doğrulamaz.
  Geometrik halka sayısını etap sayısı olarak sunmaz.
- `catalog.mjs`: Dikmen ve Öveçler için ad kanıtı ile sınır kanıtını ayırır.
  Dikmen'in tek OSM relation bağlantısı bellidir. Öveçler için kimlik bağlantısı
  doğrulanmadığından ad eşleştirmesi yapılmaz. İki grubun da etap geometrisi yoktur.
- `selection-draft.mjs`: varsayılan mevcut kapsamı döndürür. Deney etkinse yalnız
  aynı park grubundaki kimliği açık, kaynak/sürüm/lisansı ve inceleme kaydı bulunan,
  incelenen geometri SHA-256 değeri aynı kalan bir bölümün bağımsız taslağını üretir.
  GeoJSON yapısı kontrol edilir; mekânsal geçerlilik incelemesi bir beyan olarak
  beklenir, burada yeniden hesaplanmaz. Hiçbir çıktı analiz çalıştırma yetkisi vermez.
  Çoklu seçim birleşim uygulanana kadar reddedilir; örtüşen alanlar toplanmaz.
  Taslak derin kopyalanır/dondurulur; katalog veya mevcut parkı değiştiremez.
- `test/fixtures/park-stages/dikmen-topology.json`: kamuya açık OSM verisinin
  sınırlı, kaynaklı çevrimdışı özeti. Kullanıcı adı/uid/changeset bilgileri alınmadı.
  ODbL ve OpenStreetMap katkıcı atfı korundu. Dört way tek 318 node referanslı
  kapalı çevrim oluşturuyor. Bu, resmî etap sınırını kanıtlamaz.

Çalıştırma: `node --test test/park-stage-research.test.mjs` veya `npm test`.
Pozitif seçim örnekleri yalnız sentetik geometri kullanır; gerçek etap gibi sunulmaz.

## Araştırma sonucu ve veri edinme yolu

ABB'nin [7 Haziran 2021 listesi](https://www.ankara.bel.tr/tr/duyurular/baskent-parklarinda-spor-basliyor-57)
Dikmen'de 1–2 ve 3. etap adlarını ayırıyor. [18 Ağustos 2021 listesi](https://www.ankara.bel.tr/haberler/mansur-yavas-bir-sozunu-daha-tuttu-14740)
1, 2 ve 3'ü ayrı anıyor; Öveçler'de Bölüm 1/2 adları var. Dolayısıyla tek bir sabit
“iki etap” modeli yerine kaynak tarihli grup/bölüm kimlikleri gerekiyor. Ad listesi
sınır veya güncel bölüm sayısı kanıtı değildir. Konut dönüşüm kapsamı park alanına eklenmez.

[ABB CBS](https://cbsbaskent.ankara.bel.tr/) doğrudan okuma denemesinde 403 döndü;
erişim engeli aşılmadı. [Kent rehberi](https://kentrehberi.ankara.bel.tr/) görünümü,
indirilebilir etap vektörü veya yeniden kullanım izni sayılmaz. Bu araştırmada
lisansı ve etap adı doğrulanmış resmî poligon edinilmedi.

Bir sonraki veri talebi ABB Park ve Bahçeler / CBS biriminden şu teslimi istemelidir:
etap adı ve kalıcı kimlik, Polygon/MultiPolygon (delikler ve kopuk alanlar dahil),
koordinat sistemi/EPSG, kaynak tarihi/sürümü, kapsam açıklaması ve kullanım lisansı.
Bu belge ileti gönderimi değildir; kimseye mesaj gönderilmedi.

## Sıradaki küçük geliştirme

1. Kapsam kartı: mevcut park sınırı ve kaynak bilgisi, kanıtlı bölüm adları;
   sınır yokken seçilemez gerekçesi. Telefon, tema ve klavye kontrolleri.
2. Veri gelince ayrı içe aktarma/inceleme: CRS → RFC 7946 WGS84 boylam-enlem,
   öz kesişim/delik kapsaması, kopuk parçalar ve kimlik çakışması doğrulaması;
   kaynağın sürümüyle geometri hash'ini sabitleme. Fiziksel parça = etap denmez.
3. Ayrı birleşim adaptörü: Polygon/MultiPolygon birleşimi; örtüşme bir kez sayılır,
   delikler ve iç adalar korunur, bbox/konveks zarf kullanılmaz. Bu olmadan birlikte
   seçim açılmaz. Mevcut ring/backfill kodundaki olası çoklu dış halka riski için
   önce fixture ve çağrı zinciri denetimi; üretim dosyaları bu çalışmada değiştirilmedi.
4. Haritada geçici etap önizlemesi, sonra mevcut motor API'sine kontrollü kapsam
   entegrasyonu. Göksu/Başkent/Kuğulu/Dikmen regresyonu geçmeden etkinleştirilmez.
   Eski kabul edilmiş analiz ve ölçüm bağları yeni kapsama otomatik taşınmaz.

Teknik dayanak: [OSM halka algoritması](https://wiki.openstreetmap.org/wiki/Relation:multipolygon/Algorithm),
[RFC 7946](https://www.rfc-editor.org/rfc/rfc7946.html).
Detaylı önceki plan: `docs/DIKMEN-VADISI-ETAP-ARASTIRMA-PLANI-2026-10-24.md`.

## Geri dönüş

Sağlam sürüm: `b97b037c3d5267b9e3e0059777e1a18bf3c1a3b7`,
`recovery-analiz-ve-park-alan-rengi-20261024`. Bu araştırma üretimden bağımsızdır;
mevcut uygulamanın eski davranışa dönmesi için veri geri yükleme gerekmez.
