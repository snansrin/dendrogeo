# Etap seçimi ve çalışma kapsamı

Kullanıcı talebi: seçilen etap mevcut park alanı olarak kullanılsın; analiz,
ölçüm, grid, PNG ve raporlar aynı kapsamda devam etsin. Sağlam geri dönüş etiketi:
`recovery-analiz-ve-park-alan-rengi-20261024` (`b97b037`).

## Kullanım

1. Ana parkı algılayın. Park panelindeki **Etap seçimi** kartını açın.
2. Kayıtlı etabı seçip **Seçili alanla çalış** düğmesine basın.
3. Sınır yoksa **Yeni etap tanımla** ile ad verin; **Sınır çizmeye başla** ile
   köşelere dokunun. Geri al / Vazgeç / Escape kullanılabilir. Çizim sırasında
   ana parkın tamamı geçici kesik çizgiyle gösterilir; aktif analiz değiştirilmez.
4. **Sınırı kabul et ve kaydet** çizimi ana parka kırpar, ayrı etap kimliği
   oluşturur ve o alanı etkinleştirir. Bu kabul yüzey analizinin bilimsel kabulü
   değildir. Yüzey analizi ve mevcut kabul kapısı ayrıca çalışır.
5. Bu etap için **yeni proje** oluşturun. Önceki projeler/ölçümler taşınmaz.
   Mevcut etap projesi varsa seçilebilir. Ana parkın tamamına listeden dönülür.

Bu sürüm doğrulanmış resmî etap poligonları içermez. Dikmen veya başka bir parkı
adı, parça sayısı, yol/pool çizgisi veya varsayılan bir kesimle otomatik bölmez.
Kaydedilen her alan görünür biçimde **kullanıcı tanımlı etap** olarak adlandırılır.
Resmî veri kataloğunun güvenli içe aktarılması ayrı sonraki geliştirmedir.

## Kapsamın korunması

- Etap aynı `parks` sözleşmesiyle ayrı yeni satırdır; ana park satırı değişmez.
  `stage/<parentId>/<digest>` anahtarı genel yakın-ad eşleştirmesine verilmez.
  `geom_json.stage_scope` ana park kimliğini, adı ve tanım türünü saklar.
- Etap sınırı ve anahtarı kayıt sonrası değişmez; farklı sınır yeni kimliktir.
  Eski geometrinin sadeleştirilmesi/kayıt yordamı etaplarda çalıştırılmaz.
- Kapsam değişimi önce mevcut yerel analiz taslağını kaydeder. Kayıt başarısızsa
  geçiş durur. Busy/stale yanıtlar başka parkı etkinleştiremez.
- `PARK_POLY` / `PARK_HOLES` ve `DG_PARK` birlikte yeni etapla kurulurlar. Mevcut
  yüzey analizi, QA, grid, harita PNG ve kabul snapshot'ı bu girişleri kullanır.
  Kayıt ve rapor kimliği ana park yerine etabın kimliğidir; başlık tanım türünü taşır.
- Etapta grid proje listesi ana parkın veya başka parkın projelerine geri düşmez.
  Yeni ölçüm için etkin etapla bağlı proje gerekir. Geçmiş kayıt düzenlemeleri kendi
  mevcut proje/sınır doğrulamasında kalır; geriye dönük yeniden sınıflandırılmaz.
- Eski navigasyon gösterimi, waypoint önbelleği ve varsayılan proje seçimi kapsam
  değişiminde temizlenir. Veri tabanındaki noktalara ve projelere dokunulmaz.
- Yeni etap ölçümlerinde istemci ve sunucu kesin poligon kontrolü uygular.
  Etap dışı veya boşluk içi noktaya eski parkların 40 m kenar / daire yedeği
  uygulanmaz. Proje-etap uyuşmazlığı reddedilir; eski parkların kuralı değişmez.
- Etap ile ana park arasında mevcut proje yeniden bağlanamaz; yeni proje gerekir.
  Allometri, çevre/π protokolü, tür/yoğunluk verileri, raster ve motorlar değişmez.

## Sunucu hazırlığı ve yayın

Yeni dosya: `supabase/migrations/20261024190000_park_stage_scopes.sql`.
Yeni tablo/kolon yok. Yalnız yeni kapsam oluşturma/koruma fonksiyonları ve yeni
`stage/` anahtarlarını koruyan trigger'lar eklenir. Eski kayıtları güncelleyen,
taşıyan veya silen bir backfill yoktur. RPC `SECURITY INVOKER` kullanır; mevcut
RLS yetkileri geçerlidir, `PUBLIC`/`anon` için yürütme kapalıdır.

Sunucu koruması kurulmadan `dg_park_stage_ready` başarılı dönmez. Kart nedenini
gösterir, yeni etap kaydı ve mevcut etap etkinleştirme açılmaz. UI tek başına
güvenli etap ölçümü varmış gibi yayımlanmamalıdır.

İzole PostgreSQL testi SQL'i iki kez uygular; kimlik tekrarını, dış/boşluk/iç
noktaları, yanlış proje, değişmez geometri, anon engeli ve eski satırların
korunmasını doğrular. Canlı doğrulamada yalnız hazırlık RPC'si ve gerekiyorsa
eklenen fonksiyon/trigger tanımları okunur; tüm tablo/log taraması yapılmaz.

Geri dönüşte UI kapatılabilir; yeni etap verileri silinmez. Trigger'lar mevcut
etap kayıtlarını korumaya devam eder. Eski ana park kayıtlarına restore uygulanmaz.

## Testler ve sınırlar

- `test/park-stage-workspace.test.mjs`, `test/park-stage-postgres.test.mjs`.
- `scripts/park-stage-workspace-smoke.mjs`: 360/390/430 px, açık/koyu tema,
  erişilebilirlik, gerçek Leaflet çizim akışı, ayrı kimlik, grid proje izolasyonu,
  analiz API'sine etap geometrisi, rapora etap alanı ve kabul kaydına etap ID'si.
- Mevcut map-only PNG/palet, analiz etkileşimleri, ölçüm kaydetme, grid menüsü,
  çıktı önizlemesi, çizim ve yüzey menüsü sentetik tarayıcı regresyonları.
- Çizim en fazla 300 köşe; kesişen/bozuk sınır reddedilir. Sunucu halka kontrolü
  301 kapalı noktayla sınırlıdır; çok karmaşık kırpım kaydedilmez ve kullanıcıya
  hata döner. Birden fazla dış parça ve boşluklar gerçek geometrileriyle kalır;
  konveks zarf/bbox köprüsü üretilmez. Otomatik etap birleşimi bu sürümde yoktur.
- İsim adayı ve resmî sınır doğrulaması için önceki araştırma belgeleri geçerlidir.
