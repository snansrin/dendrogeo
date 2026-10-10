/* geofence.test.mjs — KONUM DOĞRULAMASI + PROJE↔PARK KİLİDİ BEKÇİSİ (0007)
 *
 * Kullanıcı isteği (2026-09-26): "proje yapılacağı zaman veya projeye fotoğraf
 * ekleneceği zaman konumdan doğrulama alsın; aynı projeye farklı parklardan
 * giriş yapılmasın; her proje park ile eşitlensin; hatalı girişlerin önüne
 * geçilsin."
 *
 * Bu dosya karar çekirdeğini (dgGeoDecide — saf fonksiyon, DOM/ağ yok) ve
 * iki katmanlı çitin KANCALARININ yerinde durduğunu kilitler:
 *   · istemci: saveMeas + dgScanCreateProject → dgVerifyAtPark
 *   · sunucu : 0007 migration → trg_geo_fence + trg_project_requires_park
 * Sunucu yarısı olmadan istemci kapısı "öneri"den öteye gitmez; istemci
 * olmadan da kullanıcıya neden gösterilemez. İkisi birlikte kilitli.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadApp } from '../scripts/test-harness.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const idx = read('index.html');
const sw = read('sw.js');
const MIG = join(ROOT, 'supabase/migrations/0007_geo_fence.sql');

/* Kare park: 39.90–39.92 enlem, 32.70–32.80 boylam (~2.2 km × 8.5 km).
 * Halka [lat,lon] çiftleri ve kapalı (ilk nokta sonda). */
const SQUARE = [
  [39.90, 32.70], [39.90, 32.80], [39.92, 32.80], [39.92, 32.70], [39.90, 32.70],
];
const PARK = {
  id: 1, name: 'Test Parkı',
  centroid_lat: 39.91, centroid_lon: 32.75,
  area_m2: 19_000_000,
  geom_json: { outer: [SQUARE], inner: [] },
};
const DELIKLI = {
  ...PARK,
  geom_json: { outer: [SQUARE], inner: [[[39.905, 32.74], [39.905, 32.76], [39.915, 32.76], [39.915, 32.74], [39.905, 32.74]]] },
};
const MIRAS = { id: 2, name: 'Miras Park', centroid_lat: 39.91, centroid_lon: 32.75, area_m2: 400_000, geom_json: null };
const fix = (lat, lon, acc = 10) => ({ lat, lon, acc });

describe('dgGeoDecide — poligon kararı', () => {
  const ctx = loadApp();
  const decide = (f, p, o) => ctx.dgGeoDecide(f, p, o);

  test('poligon içinde → ok + verified (inside)', () => {
    const d = decide(fix(39.91, 32.75), PARK);
    assert.equal(d.ok, true); assert.equal(d.verified, true);
    assert.equal(d.reason, 'inside'); assert.equal(d.inside, true);
  });

  test('kenarın ~20 m dışı → MARGIN payıyla ok (GPS/OSM gürültüsü)', () => {
    const d = decide(fix(39.89982, 32.75), PARK);   // kenar ≈ 20 m
    assert.equal(d.ok, true, 'kenar payı içinde kabul edilmeli');
    assert.equal(d.reason, 'margin');
    assert.equal(d.verified, true);
  });

  test('⭐ kenarın ~220 m dışı → RED (daire yedeğine DÜŞMEZ, poligon varsa)', () => {
    const d = decide(fix(39.898, 32.75), PARK);
    assert.equal(d.ok, false, 'poligon varken daire yedeği çiti gevşetememeli');
    assert.equal(d.reason, 'outside');
    assert.equal(d.verified, false);
    assert.ok(d.edgeM > 40, 'kenar mesafesi raporlanmalı');
  });

  test('⭐ başka park/bölge → RED + mesafe raporu', () => {
    const d = decide(fix(40.5, 33.5), PARK);
    assert.equal(d.ok, false); assert.equal(d.reason, 'outside');
    assert.ok(d.distM > 10000, 'merkeze uzaklık anlamlı olmalı');
  });

  test('delik (inner ring) içinde → RED', () => {
    const d = decide(fix(39.91, 32.75), DELIKLI);
    assert.equal(d.ok, false, 'park içindeki delik alanda doğrulama olmamalı');
  });

  test('⭐ GPS hassasiyeti ±60 m üstüyse doğrulama YOK (kaba konumla damga vurulmaz)', () => {
    const d = decide(fix(39.91, 32.75, 120), PARK);
    assert.equal(d.ok, false); assert.equal(d.reason, 'acc');
  });

  test('fix yoksa RED (no-fix), park yoksa doğrulamasız OK (no-park)', () => {
    assert.equal(decide(null, PARK).ok, false);
    const np = decide(fix(39.91, 32.75), null);
    assert.equal(np.ok, true); assert.equal(np.verified, false); assert.equal(np.reason, 'no-park');
  });
});

describe('dgGeoDecide — miras park (geom_json yok) daire yedeği', () => {
  const ctx = loadApp();
  test('alan yarıçapı içinde ok ama verified DEĞİL (damga yok)', () => {
    const d = ctx.dgGeoDecide(fix(39.912, 32.752), MIRAS);
    assert.equal(d.ok, true);
    assert.equal(d.verified, false, 'poligonsuz park "doğrulandı" damgası almamalı');
    assert.equal(d.reason, 'circle');
  });
  test('yarıçap dışında RED', () => {
    const d = ctx.dgGeoDecide(fix(40.2, 33.1), MIRAS);
    assert.equal(d.ok, false); assert.equal(d.reason, 'outside');
  });
});

describe('halka sadeleştirme (jsonb boyutu)', () => {
  const ctx = loadApp();
  test('1200 noktalı halka ≤501 noktaya iner ve kapalı kalır', () => {
    const ring = Array.from({ length: 1200 }, (_, i) => [39.9 + Math.sin(i / 40) * 0.01, 32.7 + Math.cos(i / 40) * 0.01]);
    const s = ctx.dgSimplifyRing(ring, 500);
    assert.ok(s.length <= 501, 'nokta sayısı sınırlanmalı');
    /* harness notu: vm realm'leri arasında deepStrictEqual PROTOTYPE farkıyla
     * patlar → eleman bazında karşılaştır. */
    assert.equal(JSON.stringify(s[0]), JSON.stringify(s[s.length - 1]), 'halka kapalı kalmalı');
  });
  test('küçük halkaya dokunmaz', () => {
    assert.equal(ctx.dgSimplifyRing(SQUARE, 500).length, SQUARE.length);
  });
});

describe('istemci kancaları yerinde (atlama yok)', () => {
  test('saveMeas: fotoğraf/yükleme ÖNCESİ dgVerifyAtPark + damga', () => {
    const m = read('src/services/measure.js');
    const i = m.indexOf('async function saveMeas');
    const govde = m.slice(i, m.indexOf('// 3. OFFLINE KONTROLÜ', i));
    assert.match(govde, /dgVerifyAtPark\(pk\.data,"measure"\)/, 'ölçüm kaydı konum doğrulamalı');
    assert.match(govde, /dgGeoStamp\(base,dec\)/, 'doğrulama damgası satıra yazılmalı');
    const vi = govde.indexOf('dgVerifyAtPark');
    const up = m.indexOf('storage.from', i);
    assert.ok(vi > -1 && up > -1, 'kanca ve upload bulunmalı');
    assert.match(govde, /if\(!dec\.ok\)return toast/, 'reddedilirse yükleme başlamamalı');
  });

  test('doğrulama YALNIZ ölçümde; proje açılışında konum bloğu YOK (2026-09-27 kesin)', () => {
    /* Kullanıcı: "uzaktaki bir parka proje oluşturamıyorum… sadece ölçüm
     * giremeyim". Bu blok daha önce 'silindi' sanılıp testi güncellenmemişti;
     * artık hem kod hem test tek doğruda. */
    const p = read('src/services/park-registry.js');
    const i = p.indexOf('async function dgScanCreateProject');
    const govde = p.slice(i, p.indexOf('async function dgLinkProject', i));
    const app = read('src/application/parks/create-project.js');
    assert.doesNotMatch(govde+app, /dgVerifyAtPark/, 'proje açılışı GPS ile bloklanmamalı');
    assert.match(app, /persistGeometry\(park\)/, 'halkalar sunucuya yazılmalı');
    assert.match(p, /async function dgScanSearchByName/, 'uzak park için ada göre arama olmalı');
  });

  test('yönetici istisnası: dgGeoOverride + tablo düğmesi', () => {
    const a = read('src/services/admin.js');
    assert.match(a, /async function dgGeoOverride/, 'istisna fonksiyonu olmalı');
    assert.match(a, /geo_override_by:USER\.id/, 'audit izi yazılmalı');
    assert.match(a, /onclick="dgGeoOverride\(/, 'tabloda düğme olmalı');
    assert.match(a, /role!=="admin"&&PROFILE\.role!=="owner"/, 'yetki kontrolü istemcide de olmalı');
  });

  test('geofence.js yükleniyor: index.html + sw PRECACHE + sıra (park-geometry’den sonra)', () => {
    assert.match(idx, /src\/services\/geofence\.js\?v=[a-f0-9]+/, 'index.html script etiketi');
    assert.match(sw, /'\/src\/services\/geofence\.js'/, 'sw PRECACHE (çevrimdışı çit çalışsın)');
    const gi = idx.indexOf('src/services/geofence.js');
    const pi = idx.indexOf('src/services/park-geometry.js');
    assert.ok(pi > -1 && gi > pi, 'sıra: park-geometry → geofence (pointInPark önce tanımlanmalı)');
  });
});

describe('sunucu çiti (0007 migration) — istemci atlatılsa bile red', () => {
  test('migration dosyası var ve tetikler tanımlı', () => {
    assert.ok(existsSync(MIG), '0007_geo_fence.sql eksik');
    const s = read('supabase/migrations/0007_geo_fence.sql');
    for (const t of ['trg_geo_fence', 'trg_project_requires_park', 'tg_geo_fence', 'dg_point_in_park', 'dg_park_radius_m', 'dg_hav_m'])
      assert.ok(s.includes(t), t + ' migration’da olmalı');
    assert.match(s, /add column if not exists geom_json jsonb/, 'parks.geom_json');
    assert.match(s, /geo_override_by/, 'audit sütunu');
    assert.match(s, /errcode = '23514'/, 'çit ihlali check_violation ile reddedilmeli');
    assert.match(s, /errcode = '42501'/, 'istisna yetkisi sunucuda da denetlenmeli');
    assert.match(s, /before insert or update of lat, lon, project_id, park_id/, 'tetik kapsamı');
    assert.match(s, /before insert on public\.projects/, 'her proje parka bağlı');
  });
  test('trigger güvenlik modeli: security definer + search_path (RLS içi okuma)', () => {
    const s = read('supabase/migrations/0007_geo_fence.sql');
    assert.match(s, /language plpgsql security definer set search_path = public/, 'tg_geo_fence definer olmalı');
  });
});

describe('konum yeteneği hiç yoksa: sert blok yok, sunucu çiti aktif', () => {
  test('harness ortamında (geolocation yok) dgFreshFix unavailable reddeder', async () => {
    const ctx = loadApp();
    let err = null;
    await ctx.dgFreshFix().catch((e) => { err = e; });
    assert.ok(err, 'geolocation yoksa promise reddedilmeli');
    assert.equal(err.code, 'unavailable');
  });
  test('dgVerifyAtPark no-geo durumunda ok ama verified=false', async () => {
    const ctx = loadApp();
    const d = await ctx.dgVerifyAtPark(PARK, 'measure');
    assert.equal(d.ok, true, 'sensörsüz cihaz kilitlenmemeli');
    assert.equal(d.verified, false, 'damga vurulmamalı');
    assert.equal(d.reason, 'no-geo');
  });
});
