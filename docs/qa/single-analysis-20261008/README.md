# Tek park analizi düzeltmesi — 8 Ekim 2026

Başlangıç: main `51d61508849ea99d19265bc8e7fd4ade9af9c051`. Kullanıcı bu sürümde grid üretiminin engellendiğini bildirdi; tek detaylı yüzey analizi, beş sınıf, yolların sert zemin hesabına alınması ve daha küçük önizleme barları istedi. Ek su çekilmesi analizini reddetti.

## Uygulanan değişiklik

- Tek tıklama, bir WorldCover kaynak okuması ve bir Sentinel profili üretir. Bu kaynak adımları aynı taslağı besler. Ayrı ikinci su profili ve panel renderinden başlatılan otomatik arka plan taraması kaldırıldı.
- Tek analiz, nötr 50 eşiklerinde yeterli spektral kanıtı taslak sınıfa uygular. Standart manuel Tara akışının önceki davranışı korunur. Manuel hücre ve sınır kararları önceliklidir; ham raster ve kabul edilmiş rapor geçmişi değiştirilmez.
- Otomatik tarama, kullanıcı dönem seçmemişse en güncel pencereyi kullanır. Su tahmini geçmiş yıllık maksimumdan mevsimsel su üretmez. Kanıt yetersiz veya kararsızsa kaynak sınıfı korunur; bu davranış güncel görüntünün doğruluğunu kanıtlamaz.
- Aynı parkın OSM yol izleri mevcut kesin geometriyle aynı bölüşüme eklenir. Yol sayısı ve uzunluğundan dolayı sessiz atlama sınırları kaldırıldı. Bina, su maskeleri ve manuel geometri önceliği korunur. Malzeme/genişlik etiketi olmayan OSM yollarında mevcut varsayılan dar iz bir çıkarımdır; ölçülmüş yol genişliği değildir.
- Grid tek analiz sürerken başlamaz; analiz tamamlanınca kullanılabilir. Görsel/spektral taslak değişiklikleri kaynak imzasını değiştirir; işlem sırasında değişen yüzeyin gridi yayınlanmaz. Bu testler kullanıcı cihazındaki özgül hatanın kök nedenini kesin olarak doğrulamaz.
- Önizleme çubukları masaüstünde 10→6 px, telefonda 9→5 px oldu; satır dolguları küçüldü. Tema, sınıf renkleri ve değerler korundu. Çevrimdışı paket r97.
- Önceki motor kilidi kaldırılmadı. Kullanıcının açık motor/grid geliştirme talebi doğrultusunda değişen kilitli dosyalar ve manifest parmak izi güncellendi; ilk referans ve kurtarma dalı korundu.

## Doğrulama

`npm run check`: 1.485/1.485 geçti. Ardından aynı grid regresyon dosyasına eklenen tamamlanmış analizden sonra gerçek buildGrid akışı ve yüzey değişirken eski gridin korunması testi ayrıca geçti; toplam 1.486 test. Kaynak dosya sözdizimi, içerik sürümleri, üretilmiş index, CSP ve kaynak kilidi geçti. Yeni r97 değişikliğiyle son tam kontrol tekrar çalıştırıldı.

Üç gerçek park, `scripts/val-qa.mjs --park ... --city Ankara --s2-mode latest` ile kaynaklardan tekrar çalıştırıldı; ham çıktı dosyaları yan taraftadır. Bu araç ham WorldCover–Sentinel karşılaştırmasıdır; yeni birleşik taslağın bağımsız doğruluk testi değildir. Göksu sert zemin uyumu %46,3; Başkent %52,5; Kuğulu %17,4. Bu oranlar saha doğruluğu sayılamaz. Araçtaki spektral sahte-referans kalite kapısı üç parkta KRİTİK bildirdi; süreçlerin sıfır çıkış kodu bilimsel kabul anlamına gelmez.

Canlı sitenin girişsiz açılışı ve kullanıcının `image(10).png` ekranı incelendi. Girişli park/grid akışı ile 360/390/430 px gerçek telefon görünümü bu oturumda doğrulanmadı. Main dağıtımı yapılmadı; değişiklikler bu kontroller tamamlanana kadar taslak incelemede kalmalı. Sıfır hata veya her küçük bina/yolun tam algılanması iddiası yoktur.

## Kaynaklar

- ESA WorldCover: https://esa-worldcover.org/en/data-access — 2021, 10 m; genel doğruluk %76,7.
- Copernicus Sentinel-2: https://documentation.dataspace.copernicus.eu/Data/SentinelMissions/Sentinel2.html — bantlar 10/20/60 m; SWIR ayrıntısı küçük yol/bina algılamasını sınırlar.
- OSM yüzey etiketi: https://wiki.openstreetmap.org/wiki/Key:surface — yol türü tek başına yüzey malzemesini ölçmez.
