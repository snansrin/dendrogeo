# vendor/ — üçüncü taraf kütüphaneler

Bu dosyalar **depoya alınmış** üçüncü taraf kütüphanelerdir. Daha önce
`unpkg.com` ve `cdn.jsdelivr.net` üzerinden yükleniyorlardı.

## Neden depoya alındı

1. **Tedarik zinciri.** CDN'den yüklenen beş betik `integrity=` (SRI) olmadan
   geliyordu; yani CDN ya da aradaki bir katman ele geçirilirse sitede kod
   çalışırdı. Artık aynı kökenden geliyorlar ve içerikleri depoda sabit —
   code review ile denetlenebilir.
2. **Sabitlenmemiş sürümler.** `@supabase/supabase-js@2` ve `chart.js@4`
   adresleri *büyük sürüm içinde kayan* hedeflerdi: jsDelivr her istekte o
   anki son yamayı çözüyordu. `sw.js` bunları precache'lediği için hangi
   sürümün çalıştığı belirsizleşiyordu. Bu dosyalar indirildiğinde çözülen
   sürümler aşağıda kayıtlı.
3. **Çevrimdışı determinizm.** PWA'nın precache'i CDN erişilemediğinde
   başarısız oluyordu. Artık her şey aynı kökenden.
4. **CSP yüzeyi daraldı.** `https://unpkg.com` ve `https://cdn.jsdelivr.net`
   izin listesinden çıkarıldı.

## Dosyalar ve kaynakları

| Dosya | Sürüm | Kaynak URL |
|---|---|---|
| `leaflet-1.9.4.css` | 1.9.4 | `https://unpkg.com/leaflet@1.9.4/dist/leaflet.css` |
| `leaflet-1.9.4.js` | 1.9.4 | `https://unpkg.com/leaflet@1.9.4/dist/leaflet.js` |
| `MarkerCluster-1.5.3.css` | 1.5.3 | `https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css` |
| `MarkerCluster.Default-1.5.3.css` | 1.5.3 | `https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css` |
| `leaflet.markercluster-1.5.3.js` | 1.5.3 | `https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js` |
| `supabase-js-2.116.0.js` | **2.116.0** | `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2` |
| `geotiff-2.1.3.js` | 2.1.3 | `https://cdn.jsdelivr.net/npm/geotiff@2.1.3/dist-browser/geotiff.js` |
| `chart.js-4.5.1.js` | **4.5.1** | `https://cdn.jsdelivr.net/npm/chart.js@4` |

Toplam ~0,9 MB. Dosyalar **bayt bayt upstream ile aynı** — doğrulamak için:

```bash
curl -sL https://unpkg.com/leaflet@1.9.4/dist/leaflet.js | diff - vendor/leaflet-1.9.4.js
```

Dört betikte `//# sourceMappingURL=...map` yorumu duruyor ve `.map` dosyaları
depoda **yok**. Bu yalnızca DevTools açıkken kaynak panelinde zararsız bir 404
üretir; normal kullanıcının konsoluna çıkmaz. Dosyaları upstream ile bayt bayt
aynı tutmak, doğrulanabilirlik için bu küçük gürültüye tercih edildi.

## Depoda OLMAYAN dış kaynak

**`https://challenges.cloudflare.com/turnstile/v0/api.js`** bilerek CDN'de
bırakıldı: `auth.js` tarafından dinamik enjekte ediliyor ve Cloudflare bu
betiği kendi sürümlüyor. Sabitlemek widget güncellemelerini kırar. Bu yüzden
`challenges.cloudflare.com` CSP'de durmaya devam ediyor.

**Google Fonts** (`fonts.googleapis.com` + `fonts.gstatic.com`) da CDN'de:
dönen CSS kullanıcı ajanına göre farklı woff2 dosyalarına işaret ediyor, yani
statikleştirmek ayrı bir iş. İstenirse ileride `fontsource` ile depoya alınabilir.

## Sürüm yükseltme

1. Yeni sürümü indir, bu dizine `<ad>-<sürüm>.js` biçiminde koy
2. `index.html` referansını güncelle
3. `sw.js` `CORE_ASSETS` listesini güncelle **ve `CACHE_VERSION`'ı artır**
4. Bu tabloyu güncelle
5. `npm run check` çalıştır (CSP denetimi yeni origin gerekmediğini doğrular)

SRI (`integrity=`) **bilinçli olarak kullanılmıyor**: dosyalar artık aynı
kökenden geldiği için SRI'nin koruduğu tehdit (ağ üzerinde değişiklik) yok,
buna karşılık her dosya değişiminde hash'i elle güncelleme kırılganlığı var.
Güvence bunun yerine depodaki dosyanın kendisi + code review.
