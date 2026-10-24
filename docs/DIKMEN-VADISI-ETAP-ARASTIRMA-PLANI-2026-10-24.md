# Dikmen Vadisi: etap algılama ve güvenli geliştirme planı

24 Ekim 2026. Bu belge araştırma ve tasarım kararıdır; etap algılama, analiz motoru veya veri tabanı değişikliği bu çalışmada uygulanmaz.

## Bulgular

Kullanıcının parkı bölümleriyle seçip analiz etme ihtiyacı karşılanabilir. Geometrik parça sayısı ile resmî etap sayısı ayrı kaydedilmelidir. Aynı park tek kapalı sınırla çizilmiş olsa da birden fazla etap içerebilir; bir etap da birkaç kopuk poligondan oluşabilir.

1. Kültür ve Turizm Bakanlığı, Dikmen Vadisi'nin **1 ve 2. etaplarını** birlikte anlatıyor ve bu kapsam için 378.000 m² yayımlıyor. Sayfa 4 Aralık 2019 güncellemesini taşıyor; bu sayı güncel rasterın hedef alanı yapılamaz. [Kültür Portalı](https://www.kulturportali.gov.tr/turkiye/ankara/gezilecekyer/dkmen-vads)
2. ABB'nin 7 Haziran 2021 tarihli park listesi **“Dikmen Vadisi 1-2. Etap” ve “Dikmen Vadisi 3. Etap”** başlıklarını ayrı sayıyor. Kullanıcının gördüğü iki ana bölümün bu iki kapsamı temsil etmesi mümkündür; kesin bölüm eşleştirmesi için sınır kanıtı gerekir. [ABB park listesi](https://www.ankara.bel.tr/tr/duyurular/baskent-parklarinda-spor-basliyor-57)
3. ABB ayrıca “Dikmen Vadisi Son Etap Kentsel Dönüşüm Projesi”ni ayrı proje olarak sunuyor. Konut/imar projesinin kapsamı park analiz alanına otomatik eklenmemelidir. [ABB proje sayfası](https://www.ankara.bel.tr/proje/dikmen-vadisi-son-etap-kentsel-donusum-projesi-84)
4. **24 Ekim 2026'da doğrudan OSM API ile doğrulama:** `relation/14290362`, sürüm 4, son değişiklik `2026-08-05T12:47:40Z`; `leisure=park`, `name=Dikmen Vadisi`, `type=multipolygon`. Dört `outer` üye var: `1416328219`, `1547457761`, `27753021`, `1073048584`. [Birincil relation kaydı](https://api.openstreetmap.org/api/0.6/relation/14290362.json)
5. Dört üyenin node kimlikleri tek toplu istekte okundu. Hepsi açık way; uç kimlikleri birleştirildiğinde **318 node referanslı tek kapalı zincir** oluşuyor. Üyelerde etap adı bulunmuyor. Dolayısıyla bu relation'ın dört üyesini dört etap saymak, ikiye bölmek veya relation türünden birden fazla etap olduğu sonucunu çıkarmak hatalı olur. [Üye way kayıtları](https://api.openstreetmap.org/api/0.6/ways.json?ways=1416328219,1547457761,27753021,1073048584)

OSM okuması sınırlı kamu verisidir; uygulama park tabloları ve kullanıcı ölçümleri okunmadı. İsim araması için tek Overpass isteği HTTP 406 döndü; tekrar/polling yapılmadan bilinen relation ve üyeleri OSM API üzerinden doğrulandı. Arama sonucu kayıtları yerine doğrudan birincil yanıtlar esas alındı.

## Mevcut kodda durum

| Yol | Gözlem | Sonraki geliştirmede gerekli kontrol |
|---|---|---|
| `src/domain/parks/osm-rings.js` | Relation üyelerini `outer`/`inner` rollerine göre ayırıyor. | Çoklu dış halkalar, delikler, eksik üye ve açık zincirler için fixture testleri. |
| `src/application/parks/find-nominatim-boundary.js` | Polygon/MultiPolygon girişlerini ayrı dış ve iç halka dizilerine çeviriyor. | Nominatim ve doğrudan OSM yollarının aynı kanonik geometriyi üretmesi. |
| `src/adapters/parks/fetch-osm-park-ring.js` | Backfill yolunda `outer:[rings[0]], inner:rings.slice(1)` varsayımı var; bu, gerçek çoklu dış halkalarda ikinci alanı delik sayabilir. Fallback en büyük kapalı way'i seçiyor. | Üye rolleri, sıra ve tüm parçalar korunmalı. Etki analizi yapılmadan mevcut backfill çalıştırılmamalı. |
| `src/domain/surface/patch-geometry.js` | `dgSurfacePointInRings` ilk halkayı dış, kalanları delik kabul eden bir yardımcı. | Çağrı zincirinde düz halka dizisi ile gerçek çoklu dış sınırın karıştırılmadığı denetlenmeli. Her yardımcıyı topluca değiştirmek uygun değil. |
| `src/domain/surface/projected-geometry-area.js` | Dış ve iç halka dizilerini ayrı alabiliyor. | Çoklu parça desteği uçtan uca kanıtlanmalı; yalnız bu yordamın desteği yeterli değil. |

Bu dosyalar bu etap araştırması için değiştirilmedi. Belirtilen riskler kod incelemesi bulgusudur; canlı Dikmen analizinin hatalı sonuç verdiği iddiası değildir. Tek OSM çevresi etap sınırlarını sağlamadığı için yalnız mevcut relation'a bakarak doğru etap analizi yapılamaz.

## Önerilen kullanıcı akışı

1. Park seçilince mevcut sınır aynen gösterilir. Yanında kapsam metni görünür: örneğin **“Dikmen Vadisi · OSM park sınırı · etap sınırları doğrulanmadı”**.
2. Ayrı, salt okunur “Bölümler/etaplar” paneli olası kayıtları kaynaklarıyla gösterir. Doğrulanmış etap sınırı yoksa sistem “2 etap algılandı” gibi kesin bir sonuç üretmez.
3. Güvenilir etap geometrisi elde edildiğinde kullanıcı **“1–2. etap bölümü / 3. etap bölümü / Seçili bölümler birlikte”** seçeneklerinden birini seçebilir. Bunlar resmî sınır doğrulamasından önce yalnız tasarım örnekleridir.
4. Birlikte seçim, parçaların gerçek geometrik birleşimini analiz eder. Aradaki yolları/konutları dolduran konveks zarf veya bounding box park alanı yapılmaz. Kesişen parçalar iki kere sayılmaz; aynı nesnenin relation/way tekrarları ayıklanır.
5. Yeni kapsam ayrı taslak ve geometri parmak izi oluşturur. Mevcut kabul edilmiş analiz, ölçüm bağları ve yayımlanmış raporlar değişmeden kalır. Kullanıcı mevcut kabul akışıyla yeni sonucu ayrıca kabul eder.

## Etap sınırları nasıl sağlanacak?

Öncelik, ABB'den izin/lisansı ve etap adı belirli GIS sınır verisi veya resmî proje çizimidir. Kent rehberinde bir alanı görmek, vektör sınırın açık lisansla indirilebilir olduğunu kanıtlamaz; veri varlığı ve kullanım koşulları ayrıca doğrulanmalıdır. Bu araştırmada resmî etap poligonları elde edilmedi.

OSM'de açık etap adı/kimliği ve geçerli sınırı bulunan kayıt varsa, kaynak sürümüyle aday olarak alınabilir. Yakınlık, benzer isim, yol veya havuz çizgisi yalnız inceleme ipucudur; otomatik etap sınırı değildir. Resmî vektör yoksa kullanıcı ayrı çizim önizlemesinde bölümleri işaretleyebilir. Bu giriş “kullanıcı tanımlı bölüm” olarak etiketlenir; resmî etap diye sunulmaz ve açık onay olmadan kaydedilmez.

## Aşamalar ve yayın kapıları

| Aşama | Somut teslim | Sınır / kabul koşulu |
|---|---|---|
| 0 — Kanıt ve geometri testleri | Dikmen relation + 4 üye için çevrimdışı fixture; tek dış sınır, iki ayrık dış sınır, delik, iç ada ve eksik zincir örnekleri. | Canlı tabloya yazma ve yeni tarama yok. Tek halka yanlışlıkla etaplara ayrılmıyor. |
| 1 — Salt okunur kapsam paneli | Kaynak, relation/way kimliği, sürüm ve kapsam uyarısı; mevcut park seçimine ek bilgi. | Aynı park seçildiğinde mevcut motor girdisi ve hash aynen korunuyor. Telefon ve klavye kontrolleri geçiyor. |
| 2 — Doğrulanmış bölüm kataloğu | `parkGroupId`, `sectionId`, ad/alias, kaynak/lisans, geometri hash'i, doğrulama durumu içeren ayrı sürümlü kaynak dosyası. | Başlangıçta dosya tabanlı; mevcut tablo şemasına veya eski kayıtlara migration yok. Ad benzerliği tek başına üyelik oluşturmuyor. |
| 3 — Önizleme kapsam seçimi | Seçili bölümlerden kanonik Polygon/MultiPolygon üreten ayrı application/domain modülü. | Varsayılan eski davranış; bayrak kapalıyken birebir aynı sonuç. Birleşim/delik/çifte sayım, koordinat sırası ve eksik veri kapıları geçiyor. |
| 4 — Kontrollü analiz entegrasyonu | Mevcut motorun aynı API'sine yalnız yeni, açıkça seçilmiş kapsam verilir. | Göksu, Başkent Millet Bahçesi, Kuğulu ve Dikmen karşılaştırmaları; ham raster, QA, sınıf alanları, fırça/geri alma, grid/waypoint ve kabul/önizleme regresyonları. |
| 5 — Kabul, kayıt ve yayın değerlendirmesi | Gerekirse ayrı yeni kapsam kaydı için tasarım ve kontrollü geri dönüş. | Ancak kullanıcı ayrıca kapsamı onayladıktan sonra. Eski kabul geometrileri ve DOI raporları geriye dönük değiştirilmez. |

**Bir sonraki güvenli adım:** Aşama 0 ve 1. Böylece önce hangi park kapsamının seçildiğini görünür kılar ve doğru veri olmadan motora yeni geometri sokmayız. Otomatik etap birleştirmesini aynı yayına eklemek önerilmez.

## Zorunlu regresyon ve geri dönüş

- Tek OSM sınırı/4 üye = tek sınır; parça sayısı etap sayısına dönüşmüyor.
- İki ayrık bölüm, delikler ve iç adalar korunuyor; farklı yollar arasında yapay köprü oluşmuyor.
- İsim çakışması, eksik role, bozuk/açık zincir, geç gelen yanıt, cache ve parmak izi değişimi test ediliyor.
- Alan birleşim alanıdır; yüzdeler belediye sayısına uydurulmuyor. Aynı veri sürümünde mevcut park girdilerinin alan/sınıf/QA sonuçları değişmiyor.
- DBH = göğüs çevresi / π, allometri ve tür/odun yoğunluğu girdileri aynı SHA ile kalıyor.
- Kabul edilmiş sonuçlar, kayıt kimlikleri, mevcut tablolar ve yayımlanmış DOI raporları değişmiyor.
- Yeni özellik bayrağı kapatılınca eski akışa dönülüyor; veritabanı geri yükleme, reset/force push veya rapor silme gerekmiyor.
- Yayın öncesi ilgili testler, tam `npm run check`, telefon/açık-koyu tema/erişilebilirlik, CI ve canlı kaynak hashleri geçiyor.

## Teknik kaynaklar

- [OSM multipolygon modeli](https://wiki.openstreetmap.org/wiki/Multipolygon): birden fazla dış halka ve delikler; üye sırası ve yönü anlamsal bölüm sırası değildir.
- [OSM halka birleştirme algoritması](https://wiki.openstreetmap.org/wiki/Relation:multipolygon/Algorithm): kapalı halka ve iç/dış kapsama doğrulaması.
- [RFC 7946, GeoJSON](https://www.rfc-editor.org/rfc/rfc7946.html): Polygon'da ilk halka dış, diğerleri delik; MultiPolygon ayrı polygon dizileri taşır. Etap kimliği `properties` içinde ayrıca tutulmalıdır.
