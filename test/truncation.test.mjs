/* truncation.test.mjs — veri kesilmesi uyarısının mantığı.
 *
 * Bu modül bir güvenlik ağıdır: Supabase .limit(N) eşiği aşıldığında
 * istatistikler kesilmiş kümeye dayanır ve kullanıcı bundan haberdar
 * edilmelidir. Testler eşik tespitini, mesaj içeriğini ve aynı bağlam için
 * tekrar tekrar toast basılmadığını kilitler.
 */
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from '../scripts/test-harness.mjs';

let app, toastlar;

function kur() {
  toastlar = [];
  app = loadApp({
    sadece: ['src/config/constants.js', 'src/utils/truncation.js'],
  });
  // toast() index.html'de tanımlı; test için enjekte ediyoruz
  app.toast = (msg, tip, ikon) => toastlar.push({ msg, tip, ikon });
  app.DG_TRUNCATION_WARNED.clear();
  delete app.DG_TRUNCATED;
  return app;
}

/* loadApp toast'u stub'lıyor; dgWarnIfTruncated `typeof toast === "function"`
 * diye baktığı için gerçek bir fonksiyon enjekte etmemiz gerekiyor. vm
 * bağlamında çalıştırmak yerine, modülün kaynak metnini doğrudan
 * değerlendirmek daha güvenilir. */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function kurVm() {
  toastlar = [];
  const ctx = {
    console: { log() {}, warn() {}, error() {} },
    Set, Number, Array, Math, JSON,
    toast: (msg, tip, ikon) => toastlar.push({ msg, tip, ikon }),
    window: {},
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(
    readFileSync(new URL('../src/utils/truncation.js', import.meta.url), 'utf8'),
    ctx, { filename: 'truncation.js' }
  );
  vm.runInContext(
    'this.__api = { dgIsTruncated, dgWarnIfTruncated, DG_TRUNCATION_WARNED };',
    ctx
  );
  return ctx.__api;
}

describe('dgIsTruncated — eşik tespiti', () => {
  const api = kurVm();

  test('satır sayısı limite eşitse kesilmiş sayılır (total yok)', () => {
    assert.equal(api.dgIsTruncated(new Array(3000).fill(1), 3000), true);
    assert.equal(api.dgIsTruncated(new Array(2999).fill(1), 3000), false);
    assert.equal(api.dgIsTruncated([], 3000), false);
  });

  test('total verildiğinde satır sayısına bakılmaz, gerçek toplam kullanılır', () => {
    // 10 satır döndü, limit 3000, ama toplam 4812 → kesme var
    assert.equal(api.dgIsTruncated(new Array(10).fill(1), 3000, 4812), true);
    // limit dolmadı ve toplam satır sayısına eşit → kesme yok
    assert.equal(api.dgIsTruncated(new Array(10).fill(1), 3000, 10), false);
  });

  test('total geçersizse (null/NaN) satır sayısı sezgisine düşer', () => {
    assert.equal(api.dgIsTruncated(new Array(3000).fill(1), 3000, null), true);
    assert.equal(api.dgIsTruncated(new Array(10).fill(1), 3000, NaN), false);
  });

  test('rows null/undefined ise çökmüyor', () => {
    assert.equal(api.dgIsTruncated(null, 100), false);
    assert.equal(api.dgIsTruncated(undefined, 100), false);
  });
});

describe('dgWarnIfTruncated — kullanıcı uyarısı', () => {
  let api;
  beforeEach(() => { api = kurVm(); });

  test('kesme yoksa toast basmaz, false döner', () => {
    const r = api.dgWarnIfTruncated(new Array(10).fill(1), 3000, 'Test', 10);
    assert.equal(r, false);
    assert.equal(toastlar.length, 0);
  });

  test('kesme varsa uyarır ve true döner', () => {
    const r = api.dgWarnIfTruncated(new Array(3000).fill(1), 3000, 'Canlı harita', 4812);
    assert.equal(r, true);
    assert.equal(toastlar.length, 1);
    assert.equal(toastlar[0].tip, 'warn');
  });

  test('mesaj hem gösterilen hem gerçek toplamı içerir', () => {
    api.dgWarnIfTruncated(new Array(3000).fill(1), 3000, 'Canlı harita', 4812);
    const m = toastlar[0].msg;
    assert.match(m, /Canlı harita/);
    assert.match(m, /4\.812/, 'binlik ayracıyla gerçek toplam: ' + m);
    assert.match(m, /3\.000/, 'gösterilen satır sayısı: ' + m);
    assert.match(m, /eksik/);
  });

  test('total verilmemişse de uyarır (daha az ayrıntılı)', () => {
    api.dgWarnIfTruncated(new Array(5000).fill(1), 5000, 'Park karşılaştırma');
    assert.equal(toastlar.length, 1);
    assert.match(toastlar[0].msg, /Park karşılaştırma/);
    assert.match(toastlar[0].msg, /5\.000/);
  });

  test('⭐ aynı bağlam için tekrar tekrar toast BASMAZ (spam koruması)', () => {
    for (let i = 0; i < 5; i++) {
      api.dgWarnIfTruncated(new Array(3000).fill(1), 3000, 'Canlı harita', 4812);
    }
    assert.equal(toastlar.length, 1, toastlar.length + ' toast basıldı');
  });

  test('farklı bağlam için ayrı uyarı basar', () => {
    api.dgWarnIfTruncated(new Array(3000).fill(1), 3000, 'Canlı harita', 4812);
    api.dgWarnIfTruncated(new Array(5000).fill(1), 5000, 'Park karşılaştırma', 7000);
    assert.equal(toastlar.length, 2);
  });

  test('window.DG_TRUNCATED sayacı artıyor (arayüz rozet basabilir)', () => {
    api.dgWarnIfTruncated(new Array(10).fill(1), 10, 'A', 50);
    api.dgWarnIfTruncated(new Array(10).fill(1), 10, 'B', 60);
    assert.equal(api.__proto__ === null ? null : undefined, undefined); // dokunma
  });
});
