# Etap yönetimi ve detaylı uç sınırı düzenleme

Üst menü artık **Etaplar** adını taşır. Kayıtlı alanı seçtikten sonra
**Seçili etapta çalış** veya **Etap düzenle** kullanılabilir. Ana park seçiliyken
etap düzenle düğmesi kapalıdır. Yeni etap oluşturma aynı menüde devam eder.

## Noktalarla başlangıç / bitiş

- Düzenleyici yalnız başlangıç ve bitiş hatlarını tutar. Ana parkın yan çevresi
  veya boşlukları tutamaçlara dönüştürülmez; maskenin gerçek parkla kesişiminden
  alınır. Analiz motoru, bilimsel alan hesabı veya ana park kaydı değiştirilmez.
- Her hatta 2–40 nokta kullanılabilir. Başlangıç noktaları `1.1, 1.2, …`, bitiş
  noktaları `2.1, 2.2, …` olarak numaralanır. İşaretler sürüklenebilir.
- Sınır hattının arasına dokunmak ara nokta ekler. Soldaki panelden hat seçilir;
  seçmek diğer hattı silmez. **Hattı tamamla**, **Son noktayı geri al** ve
  **Seçili hattı temizle** yalnız seçilen hatla ilgilenir.
- Baştan çizimde başlangıç noktaları sırayla yerleştirilir; **Hattı tamamla**
  bitiş hattına geçirir. İkinci hat tamamlanınca alan önizlenir. Katlanan,
  kesişen, çok yakın veya parkla kesişmeyen hatlar kaydedilemez.
- Kayıtlı geometriden iki uç hattı güvenle ayrılabiliyorsa bunlar açılır.
  Eski etapta kopuk uç parçaları veya belirsiz geometri varsa birleştirme
  uydurulmaz: kullanıcıya yalnız iki uç hattını yeniden yerleştirmesi söylenir.
  Gerçek Dikmen sınırındaki ayrık kesit örneği bu güvenli dönüşü test eder.

## Kayıt ve geçmiş

Mevcut etap sınırları ölçüm/proje/analiz kimliğiyle ilişkilidir ve sunucuda
değişmezdir. **Etap düzenle** bu korumayı kaldırmaz: varsayılan adın sonuna
`· düzenleme` ekler, kullanıcı adı değiştirebilir. Kabul edilen yeni geometri
mevcut etap oluşturma API'siyle ayrı bir kapsam olarak kaydedilir. Önceki etap,
proje, ölçüm ve raporlar eski kapsamda kalır. Yeni etap etkinleşince mevcut
proje/konum çiti, analiz ve çıktı akışı aynı şekilde devam eder.

Şema, tablo, RPC ve migration değişikliği yoktur. Önizleme aktif parkı veya
kaydı değiştirmez. Kayıt boyunca işaretler ve düğmeler kilitlenir; Escape kayıt
işlemi sürerken iptal izlenimi yaratmaz. Eski tutamaçlardan geciken olaylar ve
eski geometri hesapları yeni önizlemeyi değiştiremez.

## Doğrulama

Gerçek Dikmen geometrisi ve sentetik boşluklu parkla uç eğrileri, dışarı taşmama,
mevcut nokta limitleri, yan çevrenin korunması, eski kaydın değişmemesi ve
başlangıç/bitiş geri kazanımı test edilir. Gerçek tarayıcı akışı 360/390/430 px
boyutlarında etap açma, ara nokta ekleme, sürükleme, hattı tamamlama, erişilebilirlik
ve yeni kimlikle kayıt işlemlerini çalıştırır. Eski iki referanslı hızlı seçim,
serbest çizim, etap analizi/PNG kapsamı ve ana parka dönüş regresyonları korunur.
