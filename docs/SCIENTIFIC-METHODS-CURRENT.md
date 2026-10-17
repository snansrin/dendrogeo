# Güncel bilimsel yöntem kapsamı

17 Ekim 2026. Bu belge güncel yönteme giriş rehberidir; ayrıntılı kurallar [methods.md](methods.md), kod ve yayın anındaki DGR snapshot'ıyla birlikte okunmalıdır.

## Saha ve karbon

Ham ölçüm, 1,30 m'de mezurayla alınan göğüs çevresidir. DBH = çevre / π; boy metre, DBH santimetre, yoğunluk kg/m³ olarak saklanır. Denklem girişinde yoğunluk g/cm³'e çevrilir. Kanonik hesap `src/domain/trees/allometry.js` içindedir:

`AGB = 0.0673 × (ρ × DBH² × H)^0.976`, kök biyokütlesi `0.26 × AGB`, karbon `0.47 × (AGB + kök biyokütlesi)`. Hacim, sabit 0,5 form faktörüyle geometrik tahmindir.

Bunlar model ve katsayı varsayımlarıdır. Grup yoğunluğu saha ölçülmüş yoğunluk değildir. Yerel kent ağaçlarına aktarım uygunluğu bağımsız değerlendirme gerektirir. Kısmi envanter toplamı bütün parkın karbon stoğu olarak sunulamaz.

## Park ve yüzey

Birincil kategorik raster **ESA WorldCover 2021 v200**; **IO LULC 2020** çapraz kontroldür. OSM bina/yol/su geometrileri ayrı yardımcı kanıttır. Raster hücreleri park sınırı ve deliklerle gerçek kesişimleri üzerinden alana çevrilir; her hücre körlemesine 100 m² sayılmaz.

Yüzey inceleme sınıfları yeşil alan, sert zemin, bina, su ve çıplak zemindir. Havuz ayrı sınıf değildir. Ham kaynak, taslak düzenleme ve kabul edilmiş geometri ayrıdır. Projeksiyonla üretilmiş sınır şekilleri parka kırpılır. Görsel yakınlaştırma veya yumuşatma kaynak çözünürlüğünü artırmaz.

OSM park adayı, kayıtlı geometri seçimini kolaylaştırır; hukuki/kadastral sınır tespiti veya görüntüden otomatik doğruluk garantisi değildir. Eksik veri kapsamı açıkça taşınmalıdır.

## Göreceli NDVI

Sentinel-2 bantları maske, radyometrik ölçek/offset ve geçerli gözlem kontrollerinden geçer. Farklı tarihlerden indeks gözlemleri özetlenir. Göreceli katman yalnız yeşil sınıftaki hücreler için en az üç farklı geçerli tarih ve en az dokuz uygun hücreyle park içi medyan NDVI dağılımının 1/3 ve 2/3 niceliklerini kullanır.

Göreceli kademeler mutlak bitki sağlığı, taç yoğunluğu, ağaç sayısı veya iki park arasında aynı biyofiziksel eşik değildir. Yetersiz gözlem, sıfır bitki olarak yorumlanmaz. Aynı niceliklere düşen eşit değerlerde gruplar eşit büyüklükte olmayabilir. Bu gösterim ham raster sınıflarını ve alanlarını değiştirmez.

## Belirsizlik ve doğrulama

[Saha doğrulaması ve bağımsız referans araçları](../research/carbon/README.md), üretim motorundan ayrı çalışır. Yeni rapor formunda kapsam, ekip, cihaz kontrolü ve tekrar ölçüm beyanı isteğe bağlıdır. Yeni raporların HTML ve üst verisinde ölçüm, yoğunluk, model ve örnekleme kapsamı ayrı açıklanır; eksik bilgi doğrulanmış sayılmaz. Mevcut yoğunluklar, formüller ve Monte Carlo hesabı değiştirilmedi.

Karbon Monte Carlo aralığı kaydedilmiş varsayımlara koşulludur; örnekleme, yerel model yanlılığı ve tüm konum/yoğunluk belirsizliğini otomatik kapsamaz. Spektral kaynak uyumu bağımsız saha doğruluğu değildir. Kullanıcı tarafından kabul edilmiş harita, bağımsız referansla doğrulanmış ürün olarak adlandırılamaz.

DGR hash'i dosyanın aynı olduğunu gösterir. Aynı hesabın tekrar üretimi için girdiler, yöntem/ortam sürümleri ve çalıştırılabilir analiz de gereklidir. DOI kalıcı kimliktir; hakemlik veya bilimsel doğruluk sertifikası değildir.

## Tarihsel belgeler

[LULC_METHODOLOGY.md](LULC_METHODOLOGY.md) eski IO LULC 2020 ve doğrulama arayüzünün tarihsel kaydıdır. Oradaki eski sınıf/UI açıklamaları güncel çalışma alanının tam tanımı olarak kullanılmamalıdır. Geçmiş DGR sonuçları kendi snapshot ve kaynak tarihlerine göre değerlendirilir.

Uydu tabanlı tekil ağaç algılama ve taç çapı tahmini kaldırılmıştır. Saha ölçümü, allometri ve karbon hesabı güncel ana kapsamdır.
