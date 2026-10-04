# Bilimsel rapor yayın standardı

Üretim raporları; belge kimliği ve sürüm, yazar, ölçüm dönemi, çalışma alanı, veri kaynakları, yöntem ve değişken birimleri, nicel sonuçlar, harita, kalite kontrol sonuçları, değerlendirme, sınırlılıklar, yeniden üretim girdileri, analiz parmak izi, sürüm geçmişi, atıf ve kaynakça içerir. Bulgular betimleyici ve teknik dille yazılır. Ölçüm dışı çıkarımlar, doğrulanmamış doğruluk iddiaları ve kullanıcıya yönelik uygulama talimatları bulgu olarak sunulmaz.

DBH göğüs çapıdır; birimi cm'dir. Kayıtlı ölçümler ve karbon hesabı katsayıları değiştirilmez. Monte Carlo aralığı model ve girdi belirsizliklerini ifade eder. Tam sayım veya olasılıklı örnekleme tasarımı doğrulanmadıkça ölçülen ağaçların karbon toplamı parkın tamamına genellenmez. Kaynak, edinim tarihi, çözünürlük ve kabul edilmiş yüzey geometrileri ayrı ayrı belirtilir. Otomatik kalite kontrol, bağımsız arazi doğrulaması veya akreditasyon olarak tanımlanmaz.

04.10.2026 öncesi test raporları aktif katalogdan kaldırılmıştır. Yedek: `archive/test-publications-2026-10-04`. Kimlikler yeniden kullanılmaz. Eski yayın ve geri çekme istekleri işlenmiş kimlik listelerinde tutulur; zamanlanmış kuyruk bunları tekrar yayımlamaz. Saha ölçümleri ve kayıtlı analizler korunur. İlk üretim raporu: DGR-2026-0021 (Göksu Parkı).

## DOI kayıt süreci

DGR yerel rapor kimliğidir; DOI değildir. Yazılım veya kaynak veri seti DOI'leri rapor DOI'si olarak kullanılmaz. Atanmamış DOI, HTML ve üst veride açıkça belirtilir.

`node scripts/prepare-report-doi.mjs DGR-2026-0021` doğrulanmış PDF, veri özeti ve üst veriden Zenodo taslak üst verisini ve SHA-256 dosya manifestini üretir. Yayın paketi `doi-yayin-paketi.zip` dosyasıdır. ZIP içindeki `zenodo-metadata.json`, yükleme formunun üst verisini sağlar; API kullanımında `/api/deposit/depositions` taslağının `metadata` alanıdır. Kaydı oluşturmak için yetkili Zenodo hesabı gerekir. Hesap erişim anahtarları kaynak koduna veya yayımlanan dosyalara yazılmaz.

1. Yetkili Zenodo hesabıyla rapor taslağı oluşturulur; yayın türü Report seçilir. Tam yazar adı, tarih, başlık, açıklama, sürüm, dil ve lisans üst veri dosyasından aktarılır.
2. DOI taslakta rezerve edilir. Rezervasyon yayınlanmış DOI anlamına gelmez. Rezerve edilen DOI üst veriye ve raporun atıf/DOI alanlarına işlenir; PDF yeniden üretilir ve manifest yenilenir. Rezervasyon durumu ayrıca izlenir; taslak DOI tescil edilmiş olarak sunulmaz.
3. Son PDF ve veri dosyaları Zenodo'ya yüklenir. Kamuya açık dosyalar ve lisans gözden geçirilir; kayıt yayımlanır. Yayınlanan kayıt DOI'si ile DOI çözümleyicisinin erişimi doğrulanır.
4. Canlı raporun üst verisi, JSON-LD ve BibTeX aynı DOI'yi taşır. Veri SHA-256 değeri korunur; dosya manifesti son çıktıların SHA-256 değerlerini taşır. Veri/yöntem değişiklikleri yeni rapor ve sürüm gerektirir.

DOI bağlantısı doğrulanmadan kayıt tamamlandı olarak işaretlenmez. Hazırlanmış dosya paketi, DOI tescilinin yerine geçmez.

## Kullanıcının beyan ettiği akademik künye

Yayınla düğmesi, doğrudan yayın isteği oluşturmaz. Yazar adı, proje adı, rapor başlığı ve çalışma amacı zorunludur. Kuruma bağlı çalışmalarda kurum adı; tez/bitirme çalışmalarında danışman bilgisi gereklidir. Bağımsız çalışma seçilebilir. Bölüm, program, ORCID ve destek/proje numarası isteğe bağlıdır. ORCID kontrol basamağı denetlenir. Kullanıcı, künyenin açık yayımlanmasını ve veri kapsamını ayrıca onaylar. İptal edilen form yayın isteği oluşturmaz.

Akademik profil, kullanıcının kendi hesap üst verisinde saklanır; rol ve yetki kararlarına katılmaz. Yayın öncesi onaylanan alanlar, istek notunda sürümlü JSON olarak dondurulur; kuyruk bu künyeyi veri özeti, HTML, JSON-LD, atıf ve üst veriye aktarır. Profilin sonradan değiştirilmesi yayımlanmış raporun künyesini değiştirmez.

## Harita sunumu

Doğal çizim, ortak sınıf kenarlarını birlikte genelleştirir. Bina, havuz, OSM nesnesi, kullanıcı çizimi ve park sınırı korunur. Görsel geometri, kabul edilen hesap geometrisinden ayrıdır. Harita ve PNG aynı görsel geometriyi kullanır; kabul kaydı kesin geometrileri ve görsel geometrileri ayrı saklar. Alan, sınıf toplamı, karbon hesabı ve örnekleme gridinin geometrisi değiştirilmez. Görsel toplam alan ve sınıfların örtüşme kontrolü başarısızsa kesin geometri çizilir. Bu işlem uydu verisinin 10/20 m çözünürlüğünü artırmaz veya yeni yapı algılaması sağlamaz.

## Yetkili DOI tescili

`Rapor DOI kaydı` iş akışı, yalnız GitHub Actions `ZENODO_TOKEN` secret erişimiyle dış DOI tescilini yapar. Token depoya veya istemciye yazılmaz. Tescil sonrasında DOI, rapor üst verisine, HTML/JSON-LD atfına, PDF ve yayın paketine işlenir. Aynı rapor yeniden çağrıldığında kayıt kimliği kullanılır; ikinci DOI oluşturulmaz. `ZENODO_TOKEN` yokken DOI atanmış olarak gösterilmez.

Yayın formu saha tarihlerini, örnekleme tasarımını ve ölçüm cihazlarını da toplar. Önceki yayın formu şeması kuyrukta yeni çalışma künyesine dönüştürülür. Hesabın önceki akademik profil alanları yeni profil formuna aktarılır.
