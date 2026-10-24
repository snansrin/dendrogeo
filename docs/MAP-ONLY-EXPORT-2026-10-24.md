# Park haritası PNG düzeltmesi — 24 Ekim 2026

Başlangıç commit'i: `d6ba2dff3f52486f5d05ebb2bfce833da0c39ab9`. Değişiklikler `fix/map-only-export-20261024` dalındadır; geri dönüş için bu dalın değişiklikleri geri alınabilir. Ana çalışma kopyasına reset veya veri geri yükleme uygulanmaz.

Önceki doğrulanmış harita çıktısı, Park analizi kapatılınca yalnız park çizgisini beyaz zemine çiziyordu. Yeni salt okunur altlık modülü, ekranda seçili mevcut sağlayıcının karolarını mevcut UTM çıktı projeksiyonuna aktarır. Sokak, uydu ve topoğrafik altlık desteklenir; kaynak atıfları PNG’de görünür kalır. En fazla 80 karo, aynı anda en fazla 6 istek ve istek başına 15 saniye sınırı vardır. Eksik karo veya değişen analiz epoch'u PNG indirmesini durdurur.

“Sadece harita” anahtarı 1240 × 1240 PNG üretir; rapor başlığı, alan tablosu ve rapor çerçevesi çizilmez. Başlangıçta park sınırını açık ve analiz dolgusunu kapalı tutar; kullanıcı diğer katmanları tekrar seçebilir. Normal raporlu PNG 1240 × 1560 düzenini ve önizleme/kabul ayrımını korur. Renk kontrolü yalnız PNG sınır çizgisinin rengini değiştirir; NDVI raporlu çıktıya da taşınır.

Allometri, DBH/çevre dönüşümü, tür ve odun yoğunluğu girdileri, park algılama, raster, yüzey sınıflandırması, alan hesapları, kabul edilmiş geometri, kayıt erişimi, veritabanı tabloları ve yayımlanmış raporlar değiştirilmedi. Eski çekirdek hash'leri korunur; yalnız açık kullanıcı isteği kapsamındaki sunum/entegrasyon dosyalarının önceki/yeni SHA zinciri manifest son kaydındadır.

Regresyonlar: altlık öncesi/sonrası çizim sırası, raporsuz PNG, renk ve renk yedeği, başarısız karo, boş sınır, altlık istek sınırları, NDVI yönlendirmesi, kayıt değişmezliği; gerçek Chromium ile 360/390/430/1280 px açık/koyu tema ve üç altlık için üretilen PNG pikselleri. Test karoları sentetiktir; tarayıcı testleri dış ağı ve hesap erişimini engeller. Üç gerçek sağlayıcının bir kamu parkına ait tek karo HEAD yanıtı 200 ve CORS `*` olarak doğrulanmıştır. Tam depo kontrolü ve CI sonuçları PR’da raporlanır.
