# 🌲 DendroGeo

**Küresel Ağaç Envanteri ve Karbon Veri Sistemi** — GPS ölçümünden küresel karbon haritasına uzanan, bilimsel yöntemli saha uygulaması.

🌐 **[dendrogeo.org](https://dendrogeo.org)** · 📖 [Yöntem](docs/methods.md) · 🛰️ [Arazi örtüsü](arazi-ortusu/) · 🔐 [Güvenlik](SECURITY.md) · 🗄️ [Veri erişimi](#veri-erişimi-ve-lisans)

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.22646300.svg)](https://doi.org/10.5281/zenodo.22646300)
[![License: CC BY-NC 4.0](https://img.shields.io/badge/License-CC%20BY--NC%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc/4.0/)
[![CI](https://github.com/snansrin/dendrogeo/actions/workflows/ci.yml/badge.svg)](https://github.com/snansrin/dendrogeo/actions/workflows/ci.yml)

---

## Ne yapıyor

DendroGeo üç adımda çalışır:

1. **Sahada ölç** — çevrimdışı bile çalışan PWA: GPS konumu, çap (DBH), boy, tür ve fotoğraf. Ölçümler cihazda IndexedDB'de kuyruklanır, bağlantı gelince Supabase'e senkron olur.
2. **Yönetici onaylasın** — yayınlanan her kayıt bir moderasyon akışından geçer; onaysız veri dünya haritasına çıkmaz.
3. **Küresel harita ve istatistik** — onaylı kayıtlar Leaflet haritasında, ülke/şehir kırılımında ve park karşılaştırma raporlarında görünür. Arazi örtüsü analizi Sentinel-2 tabanlı 10 m LULC COG'undan hesaplanır.

### Bilimsel yöntem (özet)

* **Biyokütle:** Chave vd. (2014) allometrik denklemi — `AGB = 0.0673 · (ρ·D²·H)^0.976`
* **Kök biyokütlesi:** AGB × 0,26 · **Karbon oranı:** 0,47 (IPCC)
* **Odun yoğunluğu (ρ):** tür bazlı; bilinmeyen türler grup varsayılanına düşer (İbreli 446, Yapraklı 541, Diğer 493 kg/m³ — Tolunay 2013, NIR Turkey 2017)
* **Hacim:** silindir × 0,5 gövde form faktörü
* **Arazi örtüsü:** Birincil kaynak ESA WorldCover 2021 v200 (10 m, Sentinel-1 + Sentinel-2); IO LULC 2020 bağımsız çapraz doğrulama olarak kullanılır. Alanlar raster hücresi ile park polygonunun gerçek kesişimlerinden hesaplanır.

Ayrıntı ve bilinen sınırlılıklar: [`docs/methods.md`](docs/methods.md)

---

## Mimari

Build adımı **yok**: statik tek sayfa uygulaması + PWA + Supabase.

```
index.html                  tüm görünümler (klasik <script> ile yüklenir)
├── css/style.css
├── sw.js                   Service Worker — PRECACHE/RUNTIME ayrımı, offline
├── manifest.json           PWA
├── vendor/                 Leaflet, MarkerCluster, Supabase JS, Chart.js, GeoTIFF
└── src/
    ├── config/             supabase istemcisi, sabitler, tür + ρ tablosu
    ├── utils/              geo (haversine, WebMercator), truncation (limit uyarısı)
    └── services/
        ├── measure.js      saha formu, GPS, fotoğraf
        ├── offline.js      IndexedDB kuyruk + UUID dedup + senkron
        ├── map.js          canlı harita, waypoint navigasyonu
        ├── gridplan.js     örneklem ızgarası planlayıcı
        ├── landcover.js    10 m LULC COG motoru (UTM + hücre kesişimi)
        ├── world.js        park karşılaştırma, ülke/şehir yakınlaşma
        ├── dash.js         kayıtlar, grafikler, analiz
        ├── admin.js        onay/moderasyon, talepler, toplu dışa aktarım
        ├── export.js       CSV / QGIS / GeoJSON
        └── auth.js         giriş/kayıt + Cloudflare Turnstile
```

Veri modeli (Supabase/Postgres): `measurements`, `waypoints`, `projects`,
`data_requests`, `profiles`, `site_visits` + `v_global/v_country/v_city` view'ları,
Storage bucket `dendro-photos`. Erişimin tamamı **Row Level Security** ile
sunucu tarafında zorunlu kılınır; `service_role` anahtarı hiçbir zaman repoda yoktur.

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
npm run check          # sözdizimi + ?v= tutarlılığı + CSP + 150 test
npm test               # yalnız testler (node:test, bağımlılık gerektirmez)
```

150 birim testi şunları kilitler: karbon hesabı (Chave 2014, ρ fallback,
NaN yayılmaması), jeodezik alan ve geometri, **UTM projeksiyonu** (bilinen
referans değerlere karşı), Sutherland-Hodgman kırpma + alan korunumu,
Service Worker'ın çevrimdışı yedeği ve vendor kütüphanelerin global kurulumu.

GitHub Actions her push ve PR'da beş adım çalıştırır: sözdizimi (tarayıcı
semantiğiyle), `?v=` tutarlılığı, CSP↔kod tutarlılığı, birim testler ve
(yalnız `main`'e push'ta) **canlı site ↔ depo sürüklenme denetimi**.

---

## Veri erişimi ve lisans

* **Uygulama içinde:** giriş yapmış kullanıcı kendi kayıtlarını CSV / QGIS CSV / GeoJSON olarak dışa aktarabilir.
* **Lisans:** [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) — ticari olmayan kullanım, atıf şartıyla.
* **Atıf:** Zenodo DOI [10.5281/zenodo.22646300](https://doi.org/10.5281/zenodo.22646300)

```bibtex
@software{dendrogeo,
  title  = {DendroGeo: Global Tree Inventory \& Carbon Data System},
  author = {ŞİRİN, Sinan},
  year   = {2026},
  doi    = {10.5281/zenodo.22646300},
  url    = {https://dendrogeo.org}
}
```

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
