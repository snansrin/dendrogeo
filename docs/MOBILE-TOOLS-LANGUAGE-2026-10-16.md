# Telefon araçları ve İngilizce arayüz düzeltmeleri

## Kapsam

Başlangıç: `c7b44e10bafdaf1e9d43365cd3f324f6bf38d9a4`. Düzeltme dalı: `fix/mobile-tools-bilingual`.

Değişiklikler mevcut UI modülleri ve çeviri katmanındadır. Raster sınıflandırması, alan/allometri hesapları, kabul edilmiş geometri, yayımlanmış raporlar, veritabanı sorguları ve erişim politikaları değiştirilmedi.

## Bulgular ve düzeltmeler

| Bulgu | Düzeltme |
|---|---|
| Ölçüm seçicisindeki panel telefonda haritanın üzerinde açık kalıyordu. | Araç etkinleşince geçici seçici kapanır. Fırça/çizim/nesne seçimi de haritayı serbest bırakır. |
| Açık fırça, ölçüm aracı seçildikten sonra pointer olaylarını yakalayabiliyordu. | Ölçüm ve düzenleme arasında geçişte önceki geçici araç bırakılır. Kayıtlı kararlar korunur. |
| Sabit menü, sayfa kaydırılınca araç çubuğundan kopuyordu. | Scroll ve viewport değişimlerinde açık menü yeniden konumlandırılır; genişlik görünür viewport üzerinden hesaplanır. |
| Sayı içeren kayıt özetleri tam sözlük eşleşmesine girmiyordu. | Orijinal şablon ve değişkenler DOM üzerinde saklanır; iki yönde dil değişimi desteklenir. |
| Sonradan eklenen bir öğenin kendi erişilebilirlik etiketleri çevrilmiyordu. | Çeviri yürüyüşü kök öğeyi de işler. Karakter ve ilgili öznitelik değişimleri izlenir. |
| Proje kartları, ekip ekranı, profil, navigasyon ve dışa aktarım metinleri eksikti. | Eksik sözlük girdileri tamamlandı; dinamik kayıt, profil ve ortaklık özetleri şablonlara taşındı. |
| Bazı proje seçicileri kullanıcı adını çevirebilir veya park yok uyarısını Türkçe bırakabilirdi. | Kullanıcı adı korunur; uyarının şablonu dile göre değişir. |

## Doğrulama

- `npm run check`: kaynak, mimari, çekirdek hash zinciri, modül entegrasyonu, derleme, CSP ve birim regresyonları.
- `npm run check:phone`: başlangıç, profil, tema, etkileşim, yayın formu, park yönetimi, fırça, sınır çizimi, OSM kurtarma ve telefon yerleşimi.
- `scripts/mobile-tools-language-smoke.mjs`: Chromium ve WebKit'te 360/390/430 px, `hasTouch` ve `isMobile`; gerçek Leaflet üzerinde dokunarak mesafe/alan, sürükleme sonrası dokunma, araç geçişi ve menünün kapanması.
- Aynı test dolu kayıt/proje örnekleri, iki yönde dil geçişi, sonradan render, erişilebilir düğme etiketleri, kullanıcı adının korunması ve parkı olmayan proje seçicisini kapsar. Statik uygulama ekranlarında Türkçe karakter içeren kalan etiketleri de tarar.
- Dikdörtgen, daire ve çokgen testleri gerçek dokunma olaylarını kullanır; devam eden çizim, açık bitirme ve ham verinin korunması denetlenir.
- Erişilebilirlik paketi 360/390/430 px boyutlarında 13 görünümü kontrol eder.
- Yeni telefon/dil testi hem Chromium hem WebKit CI akışındadır.

Tarayıcı otomasyonu gerçek fiziksel telefon testi değildir. Park doğruluğunun bağımsız saha doğrulaması ve tam sunucu/fotoğraf yedekleme tatbikatı bu UI düzeltmesinin kapsamı değildir; önceki doğrulama raporlarındaki açık işler devam eder.
