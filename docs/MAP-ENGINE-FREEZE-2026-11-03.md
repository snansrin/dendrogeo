# Analiz motorları, canlı harita araçları ve menüler — sabit sürüm

Kullanıcının 3 Kasım 2026 talimatıyla, çalışan PR #605 sürümü (`fb8b86181784c61f16b83b2effee9e1c8e88b73d`) esas alınmıştır.

Analiz, park algılama, OSM veri erişimi/kurtarma, yüzey tarama, Dosya, Görünüm, Etaplar, Grid, Ölçüm noktaları, Katmanlar, Yüzey fırçası, Sınır düzeltme ve Veri ve ayarlar araçları ile menüleri varsayılan olarak değiştirilemez. Sunum, olay bağlantıları, yardımcı modüller, stiller ve regresyon testleri koruma kapsamındadır.

`docs/core-foundation-lock.json` içindeki `frozen_map_engines_tools_menus_2026_11_03` kategorisi dosyaları açıkça listeler. Mevcut tarihsel hash zincirleri korunur; yalnız daha önce kapsam dışında kalan dosyalar mevcut baytlarıyla eklenir. `npm run check:core-foundation`, push kancası ve CI izinsiz dosya değişikliğinde başarısız olur. Manifestin kendisi de denetleyicide SHA-256 ile sabittir.

İleride genel temizlik, iyileştirme veya başka bir özellik talebi bu kilidi kaldırma izni değildir. Korunan davranışı değiştirmek için kullanıcının ilgili parçaya yönelik yeni ve açık talimatı gerekir. Hashler otomatik topluca yenilenmez; izinli değişiklikler önceki/yeni hashler ve regresyon kanıtıyla ayrı kayda alınır.

Bu işlem çalışma zamanına özellik eklemez, veritabanını/RLS'yi değiştirmez ve üçüncü taraf servisler için kesintisizlik garantisi oluşturmaz; depo ve CI üzerinden değişiklik korumasıdır.
