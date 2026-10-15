# Mevcut ve hedef mimari — son kabul tablosu

## Uyguladığımız mimari

**Alan bazlı katmanlı modüler mimari, enjekte edilen portlarla.** Clean Architecture'ın içe doğru bağımlılık ve dış erişim ayrımı ilkelerini kullanır. Native ES module veya tam feature-first dosya ağacı uygulanmıyor. Browser runtime klasik script/global API uyumluluğunu, Node araçları ES module düzenini sürdürüyor.

```text
ui / services / bootstrap (etkileşim ve composition)
          ↓
     application (use-case / özellik durumu)
          ↓
       domain (explicit girdili saf kurallar)

application ← enjekte edilen port → adapters (HTTP / SDK / depolama)
contracts: sınır doğrulaması; workers: ağır raster/geometri işleri
```

## Mevcut / olması gereken

| Alan | İnceleme başındaki mevcut durum | Olması gereken | Son kaynak durumu |
|---|---|---|---|
| Bilimsel domain | Hesaplar ayrılmıştı; bazı kurallar örtük saat okuyordu; STAC transport ve UUID üretimi burada kalmıştı | Deterministik kurallar açık girdiler alır; transport/rastgelelik adapter'dadır | Tamamlandı; dönem, sınıf, alan ve DBH/karbon politikası korundu |
| Application | Use-case'ler ve store'lar vardı; 33 ekran/harita kontrolcüsü yanlış katmandaydı | DOM/Leaflet/form doğrudan işlenmez; veri/sunum portlarla çağrılır | Tamamlandı; 33 kontrolcü aynı kod/API ile UI'a taşındı |
| UI | Ayrı renderer'lar vardı; bazı controller'lar application'da kalmıştı | Ekran, form, dialog ve harita etkileşiminin sahibi UI olur | Tamamlandı; global fetch ve doğrudan SDK erişimi denetleniyor |
| Dış erişim | Supabase/HTTP/IndexedDB adapter'ları vardı; STAC retry ve UUID domain'deydi | Dış kaynaklar adapter'da; adapter UI/application globaline bağımlı olmaz | Tamamlandı; STAC/UUID adapter'a taşındı, ters yön kapısı eklendi |
| Durum sahipliği | Feature store'ları ve eski lexical uyumluluk değişkenleri birlikte bulunuyordu | Paylaşılan feature state kendi store'unda; kalan legacy durumun sahibi/composition sınırı açık | Korundu; grid, ölçüm proje dizini, yayın kuyruğu, davetler ve admin tree store'ları mevcut; shell/map/GPS uyumluluk durumu ui/state.js ve ilgili facade sahibinde |
| API ve DTO | Legacy DG_* girişleri, callback portları ve worker sözleşmeleri vardı | Eski giriş korunur, sınır DTO'ları doğrulanır; yeni bilimsel mantık serviste büyümez | Korundu; künye köprüsü saat girdisini bağlar, saf kural API'si ayrı kalır |
| Yükleme ve PWA | 990 modülün yükleme/precache denetimi vardı | Her modül yüklenir, çift değerlendirme yoktur; yazma/Auth cache'e alınmaz; açık iş reload ile kesilmez | 990 runtime modülü tutarlı; seçici cache ve açık iş davranışı korunuyor |
| Mimari CI | Bağımlılık/hash kapıları vardı; DOM/örtük saat/bare global kapsamı eksikti | Katman kaçakları ve yeniden oluşan borç build'i durdurur | AST katman kapısı 800, AST bağımlılık kapısı 936 modül; legacy servis DOM/Supabase/ağ borcu 0 |
| Çekirdek koruması | 802 dosya kilitliydi | Yeni sınır kontrolcüleri ve testleri de hash kilidinde olur | 950 dosya ve 612 kritik runtime modülü korumalı |
| Yerel yayın kabulü | Önceki akış grupları CI ve browser'dan geçmişti | Bu katman değişikliği ayrıca tam check, mobil, GIS ve erişilebilirlik kapılarından geçer | `npm run check`, `npm run check:phone` ve `npm run check:accessibility` geçti; 360/390/430 px, çizim/fırça, OSM kurtarma ve 13 görünüm doğrulandı |

## Seviye

Bu projeye ait kabul ölçeği: **1 dosyalara ayrılma → 2 katman/port sınırları → 3 davranış ve çevrimdışı entegrasyonu → 4 CI ile korunan mimari**. Kaynak ve yerel yayın-kabul kapıları 4. seviyeyi geçti. Bu ölçek sektör standardı veya yüzde hesabı değildir.

## Kanıt

- `npm run check:architecture`: yanlış katman sunumu, gizli domain saati/rastgeleliği/transport ve doğrudan platform/network erişimi.
- `npm run check:dependencies`: isimli ve bare global referanslarda içe doğru bağımlılık, doğrudan SDK erişimi, sıfır bilinen geçiş borcu.
- `npm run check:modules`: gerçek runtime/worker/lazy/precache ve kritik hash kapsamı.
- `test/architecture-completion.test.mjs`: kapıları bilerek ihlal eden fixtureler, explicit saat altında dönem/provenance ve gelecekteki saha tarihinin reddi.
- Korunan eski davranış testleri + gerçek Chromium oturum/OAuth/anonim giriş, fare/dokunma fırçası, kesintisiz şekil çizimi, delikli park sınırı, bayat yanıt reddi, native indirme ve OSM XML/relation/cache kurtarma.

## Kabul kaydı

15 Ekim 2026 yerel kabulü: mimari geçişin tanımlı katman, dependency, servis sınırı, script/offline, sürüm/build, CSP, regresyon, mobil Chromium ve erişilebilirlik kapıları tamamlandı. 950 korumalı dosya ve 614 kritik runtime modülü doğrulandı. Format/lint eklenmedi; depo genelinde biçim standardı olmadan toplu biçimlendirme mimari tamamlanma şartı sayılmadı. Script sırasını doğrulayan mevcut build ve runtime manifestleri korundu; bunları tek kaynağa indirmek ayrı ve davranış riski taşıyan bir iyileştirme olduğu için bu kabulün dışında bırakıldı. Bu çalışma yerel kaynak kabulüdür; GitHub CI, commit/push ve canlı production sürümü doğrulanmış değildir.
