# Profil, görünüm ve tamamlama planı

Kullanıcı talebi: paneli profil ve kişisel ayarlar olarak sadeleştirmek,
paneldeki rapor bağlantısını ve bilimsel/akademik başlıkları kaldırmak,
açık/koyu görünümü mevcut tema ve modül mimarisiyle eklemek.

| Alan | Mevcut durum | Gereken / sıradaki iş |
|---|---|---|
| Profil ve kişisel ayarlar | Hesap ve isteğe bağlı çalışma bilgileri; rapor bağlantısı kaldırıldı | Mevcut profil kaydı ve iptal/odak davranışı korunur |
| Açık / koyu görünüm | Anahtar, cihaz temasına uyma ve cihazda kalıcılık | Her UI değişikliğinde iki tema regresyonu |
| Panel yoğunluğu | Kayıt/analiz özeti ayrı açılır bölümde | Profil ve tercihler ilk ekranda kalır |
| Modül mimarisi | Tercih politikası domain; depolama adapter; tema UI | Ortak yükleme/çevrimdışı zinciri ve katman kontrolleri |
| Analiz hattı | Üç parkta raster ve spektral okuma çalıştı | Otomatik uyuşmazlıklar insan referansı ile incelenmeli |
| Tam sistem + fotoğraf yedeği | Uygulama JSON'u altı tabloyu yalnız oturumun RLS kapsamıyla alır | Öncelik 1: ayrı güvenli sunucu ve Storage dosya yedeği; izole geri yükleme tatbikatı |
| Bağımsız saha doğrulaması | İnsan etiketli referanslar tamamlanmış değil | Öncelik 2: örnekleme planı, saha etiketleri ve hata matrisi |
| Cihazlar arası kampanya aktarımı | Yerel kayıt ve JSON/CSV dışa aktarma var | Sonraki aşama: owner kapsamlı senkronizasyon |
| Sürekli işletim | CI, telefon, WebKit ve otomatik kontroller var | Sonraki aşama: kaynak sağlığı, yedek yaşı ve hata takibi |

## “Kritik uyum” ifadesinin açıklaması

Önceki inceleme mesajındaki ifade tek başına yazılım arızası veya park
analizinin yanlış olduğunun kanıtı değildir. Canlı CLI koşusu, **ham WorldCover
2021** haritasıyla **2026 Sentinel-2 spektral adaylarını** karşılaştırdı. Bu
koşu, kullanıcının kabul edilmiş yüzey geometrisinin bağımsız saha doğrulaması
değildir. Göksu, Başkent ve Kuğulu'da çıkan KRİTİK kapısı bu vekil karşılaştırma
için inceleme ihtiyacını gösterir. Tarih farkı, model sınırlılıkları ve gerçek
arazi değişimi değerlendirilmeden nedeni tek başına motor koduna bağlanamaz.

Uyarıyı kaldırmak için eşik düşürülmez veya alanlar hedef yüzdeye uydurulmaz.
Bağımsız insan referans etiketleri olmadan kesin saha doğruluğu ilan edilmez.
Veri hattı, bilimsel yöntem ve bağımsız referans kanıtı ayrı değerlendirilir.
Önceki kod hataları ve canlı iş akışı kanıtları:
[16 Ekim doğrulaması](VERIFIED-AUDIT-2026-10-16.md).

## Tam yedek neden ayrı bir iş?

Tarayıcıdaki veri yedeği; Auth hesaplarını, tüm kullanıcıların RLS ile kapalı
kayıtlarını, fotoğraf baytlarını, cihaz kuyruklarını ve sunucu şemasını kapsamaz.
Yetkileri genişletmek veya tarayıcıya ayrıcalıklı anahtar koymak çözüm değildir.
Son doğrulamada Supabase organizasyonu ücretsiz plandaydı. Tam felaket
kurtarması, özel sunucu erişimi ve güvenli saklama düzeniyle kurulup izole
ortamda denenmelidir. Bu düzen kurulmuş gibi işaretlenmedi; ücretli hizmet
etkinleştirilmedi.

## Sunum ve veri sınırı

Tema tercihi yalnız `dg_appearance` cihaz anahtarına yazılır. Hesap yetkileri,
bilimsel katsayılar, sınıf geometrileri veya DOI arşivleri tema kararıyla
değiştirilmez. Harita/raster görüntüsüne renk filtresi uygulanmaz. Klasik
modüller yalnız bir kez çalıştırılır; üç küçük tercih modülü ilk boyamadan önce
çalışır, mevcut uygulama runtime paketi korunur.

## Doğrulama

3.054 kaynak testi; katman, bağımlılık, yükleme sırası, 956 dosyalık çekirdek
kilidi, sürüm ve CSP kontrolleri geçti. Chromium/WebKit'te 360/390/430/1280 px
tema kalıcılığı, cihaz tercihine uyma, profil kaydı ve iptal testleri çalıştı.
Koyu görünümde 11 sekme, landing ve dinamik yüzey kontrolleri WCAG 2.2 dahil
otomatik tarandı. İlk ziyaretin çevrimdışı kabuğuna tercih modülleri ve tema
stilleri eklendi. Otomatik testler tam WCAG uygunluk sertifikası değildir.
