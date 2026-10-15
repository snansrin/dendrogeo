# Rapor haritasında ince yolların korunması

## Bulgu

Göksu Parkı DGR-2026-0024 haritasının PNG boyutu 526 × 992 pikseldi.
540 piksel yüksekliğindeki harita alanında dar yollar az sayıda piksele düşüyordu.
Poligon dolgusunun kesirli yatay sınırları `rect` tarafından iki tarafa genişletildiği
için daha sonra çizilen komşu yeşil alanlar yol kenarlarını örtebiliyordu.

## Düzeltme

- Poligon dolgu aralıkları piksel merkezine göre, sol kapalı / sağ açık seçilir.
- Yayımlanacak PNG geometrisi her eksende üç kat çözünürlükte doğrudan çizilir.
  Mevcut küçük resim büyütülmez; ince geometriler yeni piksel ızgarasında örneklenir.
- Başlık, lejant, ölçek ve envanter işaretleri aynı mantıksal düzeni korur.
- `mapCanvas` varsayılan API boyutu korunur; `renderMapPNG` yüksek çözünürlüklüdür.
- Kaynak yüzey geometrileri, sınıf renkleri ve alan/karbon hesapları değiştirilmez.

## Arşivli rapor

DOI almış dosyalar yerinde değiştirilmez. Açık bakım komutu:

```sh
node scripts/correct-report-map.mjs DGR-2026-0024
```

Komut kaynak rapor hash'ini doğrular, aynı dondurulmuş analizden yeni DGR üretir.
Kaynak rapor, hash, DOI, analiz tarihi, çizim kodu commit'i ve düzeltme gerekçesi
yeni snapshot içinde kayıtlıdır. Yinelenen çağrı aynı düzeltmeyi tekrar yayımlamaz.
Canlı analiz/saha verisi sorgulanmaz. Normal CI hattı PDF, arşiv ve DOI'yi üretir.

## Doğrulama

`report-map-surface-fill.test.mjs` kesirli sınırlarda komşu yeşil alanların dar yolu
silmediğini; `report-map-module.test.mjs` PNG boyutunu ve girdi değişmezliğini;
`report-presentation-correction.test.mjs` bilimsel alanların korunmasını ve kaynak
hash'i bozuksa işlemin reddedilmesini denetler.
