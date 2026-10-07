# GIS, yayın erişimi ve veritabanı iyileştirmesi

Başlangıç/kurtarma noktası: `31e2ab496957b2670a52f2a3d56fac609b9ec831`.
Çalışma dalı: `fix/gis-security-hardening`. Tema, ölçüm protokolü, allometri,
odun yoğunluğu ve yayımlanmış rapor içerikleri bu çalışmanın kapsamı dışındadır.

## GIS servisleri ve spektral kanıt

STAC/SAS JSON okumaları toplam 30 saniyelik bütçe içinde en fazla üç kez
geçici 408/429/500/502/503/504 veya taşıma hatasını dener. Kalıcı 403, geçersiz
JSON ve kullanıcı iptali tekrar denenmez. Backoff ve Retry-After en fazla iki
saniyedir. İmzalama cache'i koleksiyona bağlıdır; token bitiminden iki dakika
önce kullanılmaz. Başarısız token cevabı cache'e girmez. COG byte-range HTTP
okumalarında geçici sunucu hataları da sınırlı denenir; Range başlığı korunur.
Sentinel-2 bant okumaları da aynı süre sınırlı okuyucuyu kullanır.

Sentinel-2 seçiminde farklı karo ve sezon tarihleri kapsanır. Örtüşen karolar
aynı hücre için aynı tarihi iki gözlem sayamaz. Bant CRS'si yoksa Ankara
varsayımı kullanılmaz; sahne atlanır. NDVI/MNDWI/NDBI gerçek eşzamanlı
bantların tarih başına indekslerinin medyanıdır. Mevsimsel su/yeşillenme
kanıtı iki ayrı geçerli tarihle desteklenir; ham maksimum ayrıca korunur.
Yetersiz/veri olmayan hücreler kalite istatistiğinde eksik sayılır.

Ham ESA rasterı yeniden sınıflandırılmaz. Fırça/kullanıcı sınırları ve kabul
edilmiş snapshot önceliğini korur. Kaydırıcı önizlemesi, nötr eşikler ve açık
kullanıcı kabulü mevcut sözleşmeye tabidir.

## Gerçek park testleri

Referans yılı 2021. Göksu veritabanındaki sınır; diğerleri OSM'nin gerçek park
poligonlarıdır. Nominatim gerçek Polygon/MultiPolygon ve iç boşluklar
sağladığında kullanılır; dikdörtgen veya yaklaşık daireyle değiştirilmez.

| Park | Alan (ha) | Profillenen hücre | Genel spektral uyuşma | Sert zemin uyuşması |
|---|---:|---:|---:|---:|
| Göksu | 50,01 | 7810 / 7864 | %69,1 | %37,8 |
| Başkent Millet Bahçesi | 56,77 | 8758 / 8919 | %59,8 | %57,7 |
| Kuğulu | 1,17 | 210 / 210 | %80,4 | %17,4 |

Tam çıktılar `docs/qa/` altındadır. Bu oranlar saha doğruluğu değildir;
WorldCover ve spektral kuralların uyuşmasıdır. Genel uyuşma tüm hücreleri
kapsamaz: küçük kenar hücreleri, belirsiz ve veri olmayan tahminler dışlanır.
Bu nedenle örneğin Kuğulu için %80,4 sonucu, sert zeminin doğru algılandığını
kanıtlamaz. 2021 verisi günümüzdeki yeni yapıları temsil etmez. 10/20 m
bantlardan dar yolun veya ağaç altındaki kaplamanın kesin geometrisi çıkmaz.
İnsan/saha referansı olmadan OA/κ çıktısı bilimsel doğruluk hükmü değildir.
Daha yüksek gerçek doğruluk için tarih uyumlu, bağımsız tabakalı etiketler ve
ayrı değerlendirme örneklemi gerekir; eşikler bu tabloya uydurulmadı.

## Yayın botu ve güvenlik geçişi

`report-reader` Edge Function GitHub imzasını, issuer, audience, süre,
repository/owner ID, `main` ref, olay ve dört izinli workflow yolunu doğrular.
Yalnız izinli rapor okuma kaynakları/sütunları ve sınırlı sayfalar açıktır.
Supabase ayrıcalıklı anahtarı Edge Function ortamından çıkmaz; GitHub'a veya
istemciye verilmez. `verify_jwt=false` yalnız GitHub OIDC için platform
Supabase-JWT kontrolünü devre dışı bırakır; fonksiyonun kendi imza ve yetki
kontrolü zorunludur. Anonim ve sahte token istekleri reddedilir.

Geçiş sırası: Edge Function → main workflow OIDC sağlık kontrolü →
`20261007083413_report_access_hardening.sql` → rol/yayın sağlık kontrolleri →
`20261007083543_rls_index_optimization.sql` → advisor ve rol testleri.
Kimliği doğrulanmış okuma başarılı olmadan anon grant'ları kapatılmamalıdır.

View'lar security_invoker olur; rapor talepleri yalnız sahibi veya yöneticiye
okunur. Kimlik yardımcıları exposed olmayan private schema'ya alınır;
uyumluluk wrapper'ları invoker'dır. Trigger RPC EXECUTE ve anonim davet
EXECUTE kaldırılır. Backup tablo silinmez; API dışında arşivlenir. Sekiz FK
indeksi eklenir; unique client_id indeksi korunarak iki kopya kaldırılır.
RLS kimlik çağrıları SELECT initPlan ile değerlendirilir; mevcut yetki
predikatları korunur. UPDATE için eski örtük WITH CHECK açık yazılır.

Leaked Password Protection bir Auth ayarıdır; SQL migration bunu açmaz.
Bu ayarın ayrıca dashboard/Management API ile etkinleştirilmesi gerekir.
