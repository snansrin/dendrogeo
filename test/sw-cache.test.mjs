/* sw-cache.test.mjs — Service Worker'ın cache stratejisi ve çevrimdışı yedeği.
 *
 * sw.js bir Service Worker olduğu için doğrudan import edilemez (self, caches,
 * fetch). Fonksiyonları kaynak metinden çıkarıp node:vm içinde, CacheStorage
 * API'sinin sahte bir gerçeklenmesiyle çalıştırıyoruz. Böylece "çevrimdışıyken
 * ne döner?" sorusu tarayıcı olmadan test edilebiliyor.
 *
 * Kilitlenen davranışlar:
 *   1) networkFirstWithLimit çevrimdışıyken PRECACHE'teki sorgusuz kopyaya düşer
 *   2) trimCache while döngüsüyle limite kadar siler (tek girdi değil)
 *   3) trimCache FIFO siler ama PRECACHE üzerinde ÇAĞRILMAZ (ayrı cache)
 *   4) staleWhileRevalidate ağ yoksa PRECACHE'e düşer
 */
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const swKaynak = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

/* ---------- Sahte CacheStorage ---------- */
class FakeCache {
  constructor() { this.map = new Map(); this.sira = []; }
  async match(req) {
    const k = typeof req === 'string' ? req : req.url;
    return this.map.has(k) ? { url: k, body: this.map.get(k) } : undefined;
  }
  async put(req, res) {
    const k = typeof req === 'string' ? req : req.url;
    if (!this.map.has(k)) this.sira.push(k);
    this.map.set(k, res?.body ?? res);
  }
  async keys() { return this.sira.map((u) => ({ url: u })); }
  async delete(req) {
    const k = typeof req === 'string' ? req : req.url;
    const v = this.map.delete(k);
    this.sira = this.sira.filter((x) => x !== k);
    return v;
  }
  async add(url) { await this.put(url, { body: 'PRE:' + url }); }
}
class FakeCacheStorage {
  constructor() { this.caches = new Map(); }
  async open(ad) { if (!this.caches.has(ad)) this.caches.set(ad, new FakeCache()); return this.caches.get(ad); }
  async keys() { return [...this.caches.keys()]; }
  async delete(ad) { return this.caches.delete(ad); }
}

/* ---------- sw.js'ten seçilen fonksiyonları izole çalıştır ---------- */
function yukle({ agCalisiyor = false } = {}) {
  const adlar = ['networkFirstWithLimit', 'staleWhileRevalidate', 'trimCache', 'cacheFirstWithLimit'];
  const govde = adlar
    .map((n) => {
      const m = swKaynak.match(new RegExp(`async function ${n}\\([\\s\\S]*?\\n\\}`));
      assert.ok(m, `sw.js içinde ${n} bulunamadı — fonksiyon yeniden adlandırılmış olabilir`);
      return m[0];
    })
    .join('\n\n');

  const sabitler = swKaynak.match(/^const (?:CACHE_VERSION|PRECACHE|RUNTIME|TILE_CACHE|API_CACHE|IMG_CACHE|OFFLINE_URL|MAX_TILES|MAX_IMAGES|MAX_API_CACHE|MAX_RUNTIME)[\s\S]*?$/gm).join('\n');

  const ctx = {
    caches: new FakeCacheStorage(),
    Request: class { constructor(url) { this.url = url; } },
    Response: class { constructor(body, init) { this.body = body; Object.assign(this, init); } },
    URL, Math, Number, JSON, console: { log() {}, warn() {}, error() {} },
    fetch: agCalisiyor
      ? async (r) => ({ ok: true, url: typeof r === 'string' ? r : r.url, clone() { return this; }, body: 'AGDAN' })
      : async () => { throw new TypeError('Failed to fetch'); },
  };
  vm.createContext(ctx);
  vm.runInContext(sabitler + '\n\n' + govde + '\n\nthis.__api = { networkFirstWithLimit, staleWhileRevalidate, trimCache, cacheFirstWithLimit, PRECACHE, RUNTIME, MAX_RUNTIME };', ctx, { filename: 'sw.js[izole]' });
  ctx.__api.__storage = ctx.caches;   // testlerin sahte CacheStorage'a erişimi
  return ctx.__api;
}

const REQ = (u) => ({ url: u, destination: 'script' });
const ORIGIN = 'https://dendrogeo.org';

describe('PRECACHE / RUNTIME ayrımı', () => {
  test('sw.js PRECACHE ve RUNTIME adında iki ayrı cache tanımlıyor', () => {
    const api = yukle();
    assert.match(api.PRECACHE, /^precache-/);
    assert.match(api.RUNTIME, /^runtime-/);
    assert.notEqual(api.PRECACHE, api.RUNTIME);
  });

  test('⚠️ REGRESYON KİLİDİ: networkFirstWithLimit PRECACHE üzerinden çağrılıyor', () => {
    // Bu test bilinçli olarak kaynak metni denetler: biri dördüncü argümanı
    // (fallbackCache) silerse çevrimdışı yedek sessizce ölür.
    assert.match(swKaynak, /networkFirstWithLimit\(request,\s*RUNTIME,\s*MAX_RUNTIME,\s*PRECACHE\)/);
  });

  test('⚠️ REGRESYON KİLİDİ: trimCache PRECACHE üzerinde çağrılmıyor', () => {
    assert.doesNotMatch(swKaynak, /trimCache\(\s*PRECACHE/);
    assert.doesNotMatch(swKaynak, /networkFirstWithLimit\([^)]*PRECACHE\s*,\s*MAX/);
  });
});

describe('networkFirstWithLimit — çevrimdışı yedek yolu', () => {
  let api;
  beforeEach(() => { api = yukle({ agCalisiyor: false }); });

  test('çevrimdışı + RUNTIME boş + PRECACHE dolu → sorgusuz precache kopyası döner', async () => {
    const preCache = await openCache(api, api.PRECACHE);
    await preCache.add(ORIGIN + '/src/services/gridplan.js');

    const res = await api.networkFirstWithLimit(
      REQ(ORIGIN + '/src/services/gridplan.js?v=139'), api.RUNTIME, api.MAX_RUNTIME, api.PRECACHE
    );
    assert.ok(res, 'çevrimdışıyken yanıt dönmeli (503 değil)');
    assert.equal(res.url, ORIGIN + '/src/services/gridplan.js');
  });

  test('çevrimdışı + hiçbir cache boş değil → 503 JSON döner', async () => {
    const res = await api.networkFirstWithLimit(
      REQ(ORIGIN + '/src/services/olmayan.js?v=1'), api.RUNTIME, api.MAX_RUNTIME, api.PRECACHE
    );
    assert.equal(res.status, 503);
  });

  test('çevrimdışı + RUNTIME’da tam URL varsa önce o döner', async () => {
    const rt = await openCache(api, api.RUNTIME);
    await rt.put(ORIGIN + '/src/services/map.js?v=7', { body: 'RUNTIME-KOPYA' });
    const pre = await openCache(api, api.PRECACHE);
    await pre.add(ORIGIN + '/src/services/map.js');

    const res = await api.networkFirstWithLimit(
      REQ(ORIGIN + '/src/services/map.js?v=7'), api.RUNTIME, api.MAX_RUNTIME, api.PRECACHE
    );
    assert.equal(res.url, ORIGIN + '/src/services/map.js?v=7');
  });

  test('çevrimiçi → ağdan döner ve RUNTIME’a yazar', async () => {
    const api2 = yukle({ agCalisiyor: true });
    const res = await api2.networkFirstWithLimit(
      REQ(ORIGIN + '/src/services/gridplan.js?v=139'), api2.RUNTIME, api2.MAX_RUNTIME, api2.PRECACHE
    );
    assert.equal(res.body, 'AGDAN');
  });
});

describe('trimCache — while döngüsü ve FIFO', () => {
  test('limit birden fazla aşıldığında HEPSİNİ siler (eski hali tek girdi silerdi)', async () => {
    const api = yukle();
    const c = await openCache(api, api.RUNTIME);
    for (let i = 0; i < 10; i++) await c.put(ORIGIN + '/f' + i + '.js', { body: 'x' });
    await api.trimCache(api.RUNTIME, 4);
    const kalan = await c.keys();
    assert.equal(kalan.length, 4, 'limit 4 iken ' + kalan.length + ' girdi kaldı');
  });

  test('FIFO: en eski girdiler silinir, en yeniler kalır', async () => {
    const api = yukle();
    const c = await openCache(api, api.RUNTIME);
    for (let i = 0; i < 6; i++) await c.put(ORIGIN + '/f' + i + '.js', { body: 'x' });
    await api.trimCache(api.RUNTIME, 3);
    const kalan = (await c.keys()).map((k) => k.url);
    assert.deepEqual(kalan, [ORIGIN + '/f3.js', ORIGIN + '/f4.js', ORIGIN + '/f5.js']);
  });

  test('limitin altındayken hiçbir şey silmez', async () => {
    const api = yukle();
    const c = await openCache(api, api.RUNTIME);
    await c.put(ORIGIN + '/a.js', { body: 'x' });
    await api.trimCache(api.RUNTIME, 400);
    assert.equal((await c.keys()).length, 1);
  });
});

describe('staleWhileRevalidate — çevrimdışı PRECACHE yedeği', () => {
  test('ağ yok + RUNTIME boş + PRECACHE’te sabit URL var → precache döner', async () => {
    const api = yukle({ agCalisiyor: false });
    const pre = await openCache(api, api.PRECACHE);
    await pre.add('https://cdn.jsdelivr.net/npm/geotiff@2.1.3/dist-browser/geotiff.js');
    const res = await api.staleWhileRevalidate(
      REQ('https://cdn.jsdelivr.net/npm/geotiff@2.1.3/dist-browser/geotiff.js'), api.RUNTIME
    );
    assert.ok(res, 'geotiff çevrimdışı yüklenemeli — yoksa LULC motoru çalışmaz');
  });
});

/* ---------- yardımcı: vm içindeki caches nesnesine eriş ---------- */
async function openCache(api, ad) {
  // api, ctx.__api; ctx.caches'e dolaylı erişim için trimCache/match üzerinden
  // değil, doğrudan FakeCacheStorage örneğini kullanıyoruz.
  return api.__storage.open(ad);
}
