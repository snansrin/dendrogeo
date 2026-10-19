# İkinci güvenli düzeltme incelemesi — 19 Ekim 2026

Kullanıcının MOTORA-DOKUNMAYAN-DUZELTMELER.md dosyası güncel repo ve canlı analitik uç noktasıyla karşılaştırıldı. Liste bir denetim girdisidir; “sıfır risk” veya “kesin açık” ifadeleri otomatik kabul edilmedi.

| Madde | Doğrulanan sonuç ve işlem |
|---|---|
| G1 | Ülke snapshot'ı Git'te binary işaretlendi. text/diff/merge öznitelikleri unset; dosya baytları değişmedi. |
| G2 | Kayıplı PNG palet azaltma uygulanmadı. Tema ve marka görünümünü korumak için mevcut ikonlar aynı bırakıldı. |
| G3 | console değişikliği uygulanmadı: bu servis runtime paketine girer; değişiklik app-runtime ve kilitli index sürümünü de değiştirir. “Yalnız tek serbest dosya” iddiası paketleme etkisini dışarıda bırakıyor. |
| G4 | Zaman damgalı migration kuralı önceki committe mevcut; tekrar eklenmedi. 0016–0024 hiç kullanılmadı diye kanıtsız iddia eklenmedi. |
| G5 | Cache/CORS sınırları zaten docs/CACHING ve SECURITY içinde açıklanmıştı. 600 sn her zaman tam indirme veya kesin 10 dk SW gecikmesi demek değildir. |
| G6 | Manifest'e mevcut gerçek kayıt görselleri eklendi. Boyutlar rapordaki 1200×800 değil, gerçek dosyalarda 1280×901; tarayıcı image.decode ile doğrulandı. |
| G7 | Analitik adaptörünün RPC adı, üç dönem değeri, sonuç kimliği, boş sonuç ve hata iletimi için sözleşme testleri eklendi. Bu testler geçersiz dönemlerin istemcide reddedildiğini iddia etmez; sunucu beyaz listesi ayrı korunur. |
| G8 | Var olan gerçek DOM testi iframe, javascript bağlantı, SVG, olay, stil ve özel attribute örnekleriyle genişletildi. Aktif öğe/attribute çıkışı yok; temel biçimlendirme korunuyor. |
| G9 | Yeni named-test-evidence bekçisi eklendi. 16 mevcut açık kapsam istisnası gerekçeli listede; yeni açıklanmamış boşluk ve eskimiş istisna hata verir. Bu metrik yalnız test referansı envanteridir, yüzde yüz davranış/branch/assert kapsamı olarak sunulmaz. |
| G10 | README üst bağlantısı/özellik satırı aktif yayın bulunmadığını doğrudan söylüyor. 404'te aynı buton sınıfları korunarak boş rapor dizini yerine Veri ve dışa aktarım bağlantısı verildi. |
| G11 | Kimlik/IP saklamayan worker-başına 600 kabul edilmiş metrik/dakika bütçesi eklendi. Aşımda 204 ve sıfır DB yazımı; bir pencere için tek anonim uyarı. Bu küresel/per-IP limit veya DDoS/invocation kotası koruması değildir; soğuk başlangıç/çoklu worker ile sıfırlanabilir. |
| G12 | Canlı normal, sahte cf-ipcountry=JP ve sahte x-forwarded-for=8.8.8.8 GET denemeleri aynı TR sonucunu verdi. Bildirilen sahte başlık etkisi mevcut gateway yolunda yeniden üretilemedi; başlık sırası tahminle değiştirilmedi. Bu sınırlı deney tüm proxy senaryolarının ispatı değildir. |
| G13 | Veri dosyası taşınmadı. Lisans, pinlenmiş özet ve GitHub Pages dağıtımı korunuyor. Aylık güncelleme otomatik değil; büyüme bugünkü bir üretim arızası değildir. Binary özniteliği dev metin diff'ini önler. |
| G14 | Dosya yüklenemediğinde kimlik/adres/başlık içermeyen country_snapshot_unavailable uyarısı eklendi. Supabase Storage'a taşıma yapılmadı: ek kaynak trafiği ve yeni bucket/izin yönetimi doğurabilir; aynı bölge kesin ms gecikme garantisi vermez. |
| G15 | Üç İngilizce politika sayfası zaten yayında: /en/privacy/, /en/data-protection/, /en/terms/. Listedeki “yalnız iki EN sayfa” iddiası güncel HEAD ile uyuşmuyor. Hukuki rıza metni veya EN sözlüğü değiştirilmedi. |
| G16 | İstemci kaynaklarında ayrıcalıklı JWT/secret literal kontrolü eklenip RLS tablosuna kapsamıyla yazıldı. Canlı INSERT/UPDATE/DELETE veya staging oluşturma yapılmadı; tam çok kullanıcılı/Storage davranış denetimi hâlâ tamamlanmış değildir. |

## Analitik dağıtım kanıtı

Önceki site-metrics sürüm 3 dosyaları repo dışındaki çalışma dizininde geri dönüş için saklandı. Sürüm 4 ACTIVE olarak dağıtıldı; verify_jwt=true korundu. GET sağlık kontrolleri 200/TR; ek özel alan içeren geçersiz POST 400 ile DB yazımından önce reddedildi. Gerçek metrik oluşturmak için canlıya test olayı gönderilmedi. Uç noktanın geçerli yazma yolu, 605 istekte tam 600 RPC ve 5 kayıtsız 204 cevabı veren mock sunucu regresyonuyla doğrulandı.

## Çekirdek koruması ve testler

1.025 korunan dosya denetimi geçer. Kilit manifesti, index, app-runtime, ölçüm tabloları, hesaplama, tür/yoğunluk, park algılama, analiz/tarama, araçlar ve tema CSS'i değişmedi. İkon ve kayıtlı harita görsellerinin baytları değişmedi.

Genel npm run check ve hedefli yeni testler başarılı. WebKit 360/390/430 px, iki tema, taşma/erişilebilirlik, ekran görüntüsü boyutları ve HTML temizleme denetimleri başarılı. CI ve Pages dağıtımı push sonrasında ayrıca kontrol edilir.
