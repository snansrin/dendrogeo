# 🌲 DendroGeo

**Küresel Ağaç Envanteri ve Karbon Veri Sistemi** — GPS konumlu saha ölçümlerini biyokütle/karbon hesapları, onaylı harita ve park ölçeğinde analizlerle birleştiren web GIS uygulaması.

🌐 **[dendrogeo.org](https://dendrogeo.org)** · 📖 [Yöntem](docs/methods.md) · 🛰️ [Arazi örtüsü](arazi-ortusu/) · 🔵 [Google ile giriş](docs/google-giris.md) · 🔐 [Güvenlik](SECURITY.md) · 🗄️ [Veri erişimi](#veri-erişimi-ve-lisans)

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.22646300.svg)](https://doi.org/10.5281/zenodo.22646300)
[![License: CC BY-NC 4.0](https://img.shields.io/badge/License-CC%20BY--NC%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc/4.0/)
[![CI](https://github.com/snansrin/dendrogeo/actions/workflows/ci.yml/badge.svg)](https://github.com/snansrin/dendrogeo/actions/workflows/ci.yml)

---

## Ne yapıyor

DendroGeo üç adımda çalışır:

1. **Sahada ölç** — çevrimdışı bile çalışan PWA: GPS konumu, çap (DBH), boy ve tür/grup; fotoğraf eklenirse tarayıcı içi QA/QC uygulanır. Ölçümler cihazda IndexedDB'de kuyruklanır, bağlantı gelince Supabase'e senkron olur.
2. **Yönetici onaylasın** — yayınlanan her kayıt bir moderasyon akışından geçer; onaysız veri dünya haritasına çıkmaz.
3. **Küresel harita ve istatistik** — onaylı kayıtlar Leaflet haritasında, ülke/şehir kırılımında ve park karşılaştırma raporlarında görünür. Park arazi örtüsü analizi ESA WorldCover 2021 v200 birincil kaynağı ve IO LULC 2020 çapraz kaynağıyla 10 m kategorik raster hücre kesişimlerinden hesaplanır.

**Giriş:** e-posta/parola (Cloudflare Turnstile korumalı) veya **🔵 Google ile
devam et** (Supabase OAuth, PKCE). OAuth dönüşünde `boot()` kod takasının
bitmesini bekler — aksi hâlde kullanıcı giriş olduğu hâlde landing'i görürdü.
Panel ayarları ve tuzaklar: [`docs/google-giris.md`](docs/google-giris.md).

### Park kimliği: ölçüm → park → karşılaştırma

Karşılaştırma **proje adlarına** değil, **algılanan parka** dayanır. Ölçüme
geçmeden önce park algılama ekranı açılır; park bulunur, kimliği `public.parks`
tablosuna yazılır ve proje adı `park adı - etiket` olarak kurulur
(`Göksu Parkı - deneme`). Aynı parkı üç kişi ayrı projelerde çalışsa da
karbon/kayıt/katılımcı sayıları tek satırda birleşir; park algılanmadan ölçüm
girilemez (istemci kapısı `dgParkGate`, sunucu kapısı `trg_enforce_park_link`).

* **Kimlik anahtarı:** OSM elemanı (`way/123456`). OSM'de park yoksa elle
  oluşturulur (`manual/<ad>/<~100 m hücresi>`). Ad + konum çakışırsa farklı OSM
  kimlikleri de TEK parkta birleşir (yarıçap park alanıyla büyür).
* **Sıralama kaynağı:** `v_park_compare` view'ı (sunucu tarafı `group by park`)
  → istemcide `.limit(5000)` kesilmesi yok; katkıda bulunan kişi sayısı, proje
  sayısı, tür sayısı ve **t/ha** karbon yoğunluğu buradan gelir.
* **Eski veriler:** park bağı olmayan projeler kaybolmaz, "park algılanmamış"
  bölümünde ayrıca listelenir; Yönetim → **🌳 Parkları Geri Doldur** aracı
  bunları ölçüm merkezinden OSM parkıyla eşleştirir (önce önizleme, sonra onay).
* **Yetki:** mevcut bir projeyi parka bağlamak (onarım) **yalnız yöneticiye**
  açıktır — istemcide düğmeler gizlenir, sunucuda `trg_enforce_park_admin`
  (`PARK_ADMIN_ONLY`) zorlar. Yeni proje açmak için park algılamak herkesin
  hakkıdır (INSERT serbest), yoksa saha akışı kilitlenir.
* **Şema yedeği:** `supabase/migrations/0004_parks.sql` uygulanmadıysa uygulama
  çökmez — park kimliği devre dışı kalır, karşılaştırma proje bazlı yedeğe
  düşer, kapı kilitlenmez ve ekranda migration uyarısı görünür.

### Bilimsel yöntem (özet)

* **Biyokütle:** Chave vd. (2014) allometrik denklemi — `AGB = 0.0673 · (ρ·D²·H)^0.976`
* **Kök biyokütlesi:** AGB × 0,26 sistem varsayımı · **Karbon oranı:** 0,47 sistem varsayımı
* **Odun yoğunluğu (ρ):** tür bazlı; bilinmeyen türler grup varsayılanına düşer (İbreli 446, Yapraklı 541, Diğer 493 kg/m³ — Tolunay 2013, NIR Turkey 2017)
* **Hacim:** silindir × 0,5 gövde form faktörü
* **Arazi örtüsü:** Birincil kaynak ESA WorldCover 2021 v200 (10 m, Sentinel-1 + Sentinel-2); IO LULC 2020 bağımsız çapraz doğrulama olarak kullanılır. Alanlar raster hücresi ile park polygonunun gerçek kesişimlerinden hesaplanır.

Ayrıntı ve bilinen sınırlılıklar: [`docs/methods.md`](docs/methods.md)

---

## Mimari

Dağıtılan site **statik** (GitHub Pages) + PWA + Supabase. Tek "build" adımı
`index.html`'in `partials/` altındaki dört modülden **üretilmesidir**
(`npm run build`) — derleyici/transpiler yok, klasik `<script>` etiketleri.

```
index.html                  ÜRETİLEN ARTİFAKT — partials'tan build edilir, elle düzenlenmez
├── partials/
│   ├── head.html           doctype…</head> + <body> + #toastWrap (meta/SEO/JSON-LD/asset tag'leri)
│   ├── landing.html        ★ LANDING MODÜLÜ: #topnav → hero → bölümler → footer
│   ├── shell.html          uygulama kabuğu: #apptop, #side, v-* view'ları, modaller
│   └── boot.html           src/ui/* tag'leri + </body></html>
├── css/
│   ├── style.css           ortak design-token'lar + bileşenler + uygulama stilleri
│   ├── landing.css         ★ yalnız landing'e özgü stiller (alt sayfalar yüklemez)
│   └── park-panel.css      park paneli + PNG seçenekleri (eski CSS-in-JS yerine)
├── sw.js                   Service Worker — PRECACHE/RUNTIME ayrımı, offline
├── manifest.json           PWA
├── vendor/                 Leaflet, MarkerCluster, Supabase JS, Chart.js*, GeoTIFF*
│                           (* = Faz 7'den beri TEMBEL yüklenir: src/utils/lazylibs.js)
└── src/
    ├── config/             supabase istemcisi, sabitler, tür + ρ tablosu
    ├── utils/              geo (haversine, WebMercator), truncation, lazylibs
    ├── ui/                 DOM yapıştırıcısı katmanı
    │   ├── state.js        global uygulama state'i (USER, map, WP, …) — TEK sahip
    │   ├── toast.js        bildirim baloncukları
    │   ├── landing.js      ★ initLanding() — landing modülünün beyni
    │   ├── shell.js        boot()/startShell()/go() — kabuk önyüklemesi
    │   ├── park-panel.js   park modu + sonuç paneli (drawPark)
    │   ├── park-export.js  GeoJSON/CSV/PNG indirmeleri + LULC köprüsü
    │   └── lc-report.js    LULC vektör çizimi + tek blok HTML rapor
    └── services/
        ├── measure.js      saha formu, GPS, fotoğraf
        ├── offline.js      IndexedDB kuyruk + UUID dedup + senkron
        ├── map.js          canlı harita, waypoint navigasyonu
        ├── park-state.js   ┐
        ├── osm-client.js   │ PARK ZİNCİRİ (eski gridplan.js; sıra önemli)
        ├── park-geometry.js│
        ├── park-query.js   │
        ├── park-registry.js│ ★ park kimliği + ölçüm kapısı (2026-09-24)
        ├── grid-engine.js  ┘
        ├── lc-config.js    ┐
        ├── lc-geo.js       │
        ├── lc-stac.js      │ LULC ZİNCİRİ (eski landcover.js; sıra önemli)
        ├── lc-engine.js    │
        ├── lc-osm.js       │
        ├── lc-patches.js   ┘
        ├── landcover.js    LULC facade — window.DG_LANDCOVER sözleşmesi
        ├── world.js        park karşılaştırma (v_park_compare), ülke/şehir yakınlaşma
        ├── dash.js         kayıtlar, grafikler, analiz
        ├── visit-stats.js  ┐
        ├── data-requests.js│ YÖNETİM ZİNCİRİ (eski admin.js; sıra önemli)
        ├── user-admin.js   │
        ├── backup.js       ┘
        ├── admin.js        onay/moderasyon çekirdeği + toplu dışa aktarım
        ├── admin-tree.js   ★ park→proje→kullanıcı ağacı + hata görünürlüğü
        ├── export.js       CSV / QGIS / GeoJSON
        ├── allometry.js    Chave 2014 biyokütle/karbon
        └── auth.js         giriş/kayıt + Cloudflare Turnstile
```

**Tembel yükleme (Faz 7):** `vendor/geotiff-2.1.3.js` (317 KB) ve
`vendor/chart.js-4.5.1.js` (208 KB) head'de senkron DEĞİL; `lazylibs.js`
bunları LULC analizi / panel grafiği ilk kullanıldığında enjekte eder.
Landing ziyaretçisinin ilk açılışı ~525 KB daha hafiftir. sw.js ikisini de
PRECACHE'te tutar → çevrimdışı davranış aynıdır.

**Modül değişikliği iş akışı:**

```bash
# landing'e bir şey ekleyeceksin → yalnız şunlara dokun:
#   partials/landing.html · css/landing.css · src/ui/landing.js
npm run build        # index.html'i yeniden üretir (?v= hash'leri tazelenir)
npm run check        # sözdizimi + sürüm + build tutarlılığı + CSP + testler
git add -A && git commit   # index.html DAHİL commit'le

# index.html'i yanlışlıkla elle (örn. GitHub web) düzenlediysen:
node scripts/build-index.mjs --split   # değişiklik partials'a geri emilir
```

Böylece bir landing değişikliği uygulama kabuğuna **fiziksel olarak** dokunamaz;
kabuk değişikliği de landing'e dokunamaz. `test/build-consistency.test.mjs`
bu izolasyonu CI'da kilitler.

Veri modeli (Supabase/Postgres): `measurements`, `waypoints`, `projects`,
`parks`, `data_requests`, `profiles`, `site_visits` +
`v_global/v_country/v_city/v_world_agg/v_park_compare` view'ları,
Storage bucket `dendro-photos`. `projects.park_id` projeyi fiziksel parka
bağlar; proje adını `trg_compose_project_name` ("park - etiket"), ölçüm kapısını
`trg_enforce_park_link` (`PARK_REQUIRED`) kurar. Erişimin tamamı **Row Level
Security** ile sunucu tarafında zorunlu kılınır; `service_role` anahtarı hiçbir
zaman repoda yoktur. Şema ayrıntısı: [`supabase/README.md`](supabase/README.md).

---

## Yerelde çalıştırma

```bash
git clone https://github.com/snansrin/dendrogeo.git
cd dendrogeo
python3 -m http.server 8080        # herhangi bir statik sunucu olur
# → http://localhost:8080
```

> Not: `src/config/supabase.js` içindeki **anon key** repoda açıktır ve bu
> tasarımı gereğidir: tüm erişim kontrolü sunucu tarafında RLS ile yapılır.
> Ayrıntı: [README güvenlik notu](#-güvenlik-notu) ve [`SECURITY.md`](SECURITY.md).

### Test ve denetimler

```bash
npm run check          # sözdizimi + ?v= + build + CSP + 503 test
npm test               # yalnız testler (node:test, bağımlılık gerektirmez)
npm run build          # index.html'i partials'tan üret (değişiklik sonrası)
```

503 test şunları kilitler: karbon hesabı (Chave 2014, ρ fallback,
NaN yayılmaması), jeodezik alan ve geometri, **UTM projeksiyonu** (bilinen
referans değerlerine karşı), Sutherland-Hodgman kırpma + alan korunumu,
Service Worker'ın çevrimdışı yedeği, vendor kütüphanelerin global kurulumu,
ölü buton/eksik ID denetimi, **modül kayıt bekçisi** (index↔disk↔CORE_ASSETS
↔?v= zinciri + global ad çakışması), **partial→index derleme tutarlılığı ve
landing↔shell izolasyonu**, kritik canlı düzeltmelerin canary'leri (STAC GET,
RLS-safe sayaç), tembel yükleme kilitleri ve **park kimliği** (ad
normalizasyonu + "park - etiket" adı + şema/trigger/view kilitleri;
`park-flow.test.mjs` aynı akışı sahte Supabase üzerinde uçtan uca çalıştırır),
**hukuki uyum** (`compliance.test.mjs`: harita atıfları ODbL/Esri/CC-BY-SA, KVKK
açık rıza kapısı, lisans tutarlılığı, depoda kişisel e-posta kalmadığı — hiçbiri
bozulduğunda sayfa çökmediği için testle kilitlenir) ve **sürüm tutarlılığı**
(`release.test.mjs`: sürüm numarasının yedi yerde aynı kalması + Zenodo'nun
okuduğu `CITATION.cff` künyesi).

GitHub Actions her push ve PR'da altı adım çalıştırır: sözdizimi (tarayıcı
semantiğiyle), `?v=` tutarlılığı, **derleme tutarlılığı (index.html ==
partials)**, CSP↔kod tutarlılığı, birim testler ve (yalnız `main`'e push'ta)
**canlı site ↔ depo sürüklenme denetimi** (dosya listesi index.html'den türetilir).

---

## Veri erişimi ve lisans

* **Uygulama içinde:** giriş yapmış kullanıcı kendi kayıtlarını CSV / QGIS CSV / GeoJSON olarak dışa aktarabilir.
* **Lisans:** [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) — **kod, belgeler ve veri seti birlikte**; ticari kullanım yazılı izne tabidir (`sinan@dendrogeo.org`).
  Telif: **Nagihan ŞİRİN & Sinan ŞİRİN**. Ayrıntı: [`LICENSE`](LICENSE) (tam lisans metni) + [`NOTICE`](NOTICE) (atıf biçimi ve üçüncü taraf bileşenlerin kendi lisansları).
  > ⚠ `LICENSE` eskiden **MIT** idi ve README rozeti/DOI ile çelişiyordu (2026-09-24'te CC BY-NC 4.0 ile değiştirildi). MIT'ten kalan türev çalışmalarınız varsa lisans durumunu netleştirin.
* **Atıf:** Zenodo DOI [10.5281/zenodo.22646300](https://doi.org/10.5281/zenodo.22646300)
* **Üçüncü taraf veri atıfları:** harita karoları ve park geometrileri **© OpenStreetMap contributors (ODbL)**; OpenTopoMap **CC-BY-SA**; Esri World Imagery kendi kaynak zinciriyle; arazi örtüsü **ESA WorldCover 2021 v200 (CC BY 4.0)** ve **IO LULC 2020**. Bu atıflar arayüzde Leaflet attribution kontrolünde ve PNG çıktısının telif satırında görünür tutulur (`src/config/constants.js → DG_ATTR`).

```bibtex
@software{dendrogeo,
  title    = {DendroGeo: Global Tree Inventory \& Carbon Data System},
  author   = {\c{S}irin, Nagihan and \c{S}irin, Sinan},
  year     = {2026},
  doi      = {10.5281/zenodo.22646300},
  url      = {https://dendrogeo.org},
  license  = {CC-BY-NC-4.0}
}
```

### Yasal belgeler

| Sayfa | İçerik |
|---|---|
| [`/gizlilik/`](https://dendrogeo.org/gizlilik/) | Gizlilik Politikası (12 bölüm: toplanan veriler, amaçlar, alt yükleniciler, KVKK m.11 hakları, çerez/yerel depolama, konum verisi) |
| [`/aydinlatma/`](https://dendrogeo.org/aydinlatma/) | KVKK m.10 Aydınlatma Metni (veri sorumlusu kimliği, veri kategorileri, hukuki sebepler, yurt dışı aktarım, başvuru yolu) |
| [`/kullanim-kosullari/`](https://dendrogeo.org/kullanim-kosullari/) | Kullanım Koşulları (hesap, kabul edilebilir kullanım, lisans/atıf, bilimsel sınırlılıklar) |
| [`/kunye/`](https://dendrogeo.org/kunye/) | Künye & İletişim + **içerik kaldırma/düzeltme** başvuru süreci + erişilebilirlik beyanı |
| [`SECURITY.md`](SECURITY.md) | Güvenlik açığı bildirimi |

---

## 🔒 Güvenlik notu

Bu depo Supabase `anon` anahtarını içerir; bu **bilinçli bir tasarımdır**.
Tüm veri erişimi sunucu tarafında Row Level Security politikaları ve veritabanı
trigger'ları ile zorunlu kılınır; `service_role` anahtarı repoda yoktur.
Sorumlu güvenlik bildirimi için: **security@dendrogeo.org** — ayrıntılar
[`SECURITY.md`](SECURITY.md).

---

## Yol haritası

Kısa vadede planlananlar (ayrıntılı analiz ve önceliklendirme depo dışı
raporlarda tutuluyor):

- [x] **Park kimliği** (2026-09-24): `parks` tablosu, park bazlı karşılaştırma (`v_park_compare`), ölçüm kapısı, `park adı - etiket` proje adı → `0004_parks.sql` + `src/services/park-registry.js`
- [x] **Park adı yazım düzeni** (2026-09-24): OSM'den küçük harfle gelen adlar Türkçe duyarlı başlık düzenine çevrilir (`0005_park_name_case.sql`) — `initcap` Türkçeyi bozduğu için elle eşleme
- [ ] Park polygon geometrisinin `parks`'a yazılması → Overpass/OSM çevrimdışıyken de park sınırını çizebilme
- [x] **Yinelenen park kimlikleri aracı** (2026-09-24): Yönetim → 🌳 Park Kimlikleri — çift kimlikleri ad+mesafe ile bulur, ✏️ yeniden adlandırır, 🔀 birleştirir (projeler+ölçümler taşınır, adlar yeniden kurulur), 🗑️ siler. Canlıda aynı Göksu Parkı iki kimlikle kayıtlıydı
- [ ] İstatistikleri veritabanı tarafına taşıyan `v_world_agg` view'ı + haritada bbox sayfalama (istemci tarafı `.limit()` eşiğinin tamamen kalkması)
- [ ] `allometry_version` / `rho_used` sütunları — yöntem sürümlemesi
- [ ] ρ tablosunun literatür kaynaklarıyla doldurulması (28 türde eksik)
- [ ] Denetim izi: `reviewed_by`, `reviewed_at`, `reject_reason`, `deleted_at`
- [ ] Erişilebilirlik: `<label for>` geçişi, semantik HTML, `prefers-reduced-motion`
- [ ] TR/EN i18n

---

## Katkı

Hata bildirimi ve öneriler için [issue](https://github.com/snansrin/dendrogeo/issues) açın.
Güvenlik açıkları için **issue açmayın**, security@dendrogeo.org adresine yazın.

Kod katkısı:

1. Fork edip dal açın (`fix/...` veya `feat/...`)
2. `npm run check` yeşil olmalı — CI da çalıştıracaktır
3. Bilimsel hesapları değiştiren her değişiklik **test güncellemesi gerektirir**
   (`test/allometry.test.mjs`, `test/geometry.test.mjs`, `test/landcover.test.mjs`)
4. Yeni bir dış servis ekliyorsanız **CSP'ye de yazın** — `scripts/check-csp.mjs`
   bunu denetler ve unutulursa CI kırılır

İletişim: sinan@dendrogeo.org
