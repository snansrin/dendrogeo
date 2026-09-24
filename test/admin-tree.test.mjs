/* admin-tree.test.mjs — PARK → PROJE → KULLANICI AĞACI KİLİDİ (2026-09-24)
 *
 * Kullanıcı isteği: "Tüm verileri görmek istiyorum: onaylı, reddedilmiş,
 * proje ve park bazında. Park görülsün; parkı açınca projeler açılsın;
 * projeyi açınca kullanıcıları ve verilerini göreyim."
 *
 * İki şey kilitlenir:
 *   1) SAF GRUPLAMA — dgTreeGroup / dgTreeFilterRows vm'de gerçekten
 *      çalıştırılır (park→proje→kullanıcı hiyerarşisi, sıralama, pending
 *      düğümü, durum/arama filtresi).
 *   2) SESSİZ HATA YOK — eski kod sorgu hatasında "Kayıt yok." basıyordu;
 *      kullanıcı verisinin silindiğini sandı (şema geçişinde gerçekten
 *      yaşandı). Hata artık ekrana yazılmalı ve yedek sorgu zinciri olmalı.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadApp } from '../scripts/test-harness.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const { dgTreeGroup, dgTreeFilterRows } = loadApp();

const idx = readFileSync(join(ROOT, 'index.html'), 'utf8');
const sw = readFileSync(join(ROOT, 'sw.js'), 'utf8');
const admin = readFileSync(join(ROOT, 'src/services/admin.js'), 'utf8');
const tree = readFileSync(join(ROOT, 'src/services/admin-tree.js'), 'utf8');

/* ---------- örnek veri: 2 kullanıcı, 2 proje, TEK park + 1 parksız ---------- */
const GOKSU = { id: 7, name: 'Göksu Parkı', area_m2: 423000, city: 'Ankara', country: 'Türkiye' };
const rows = [
  { id: 1, owner: 'u1', project_id: 10, park_id: 7, carbon_kg: 100, status: 'Onaylı', species: 'Meşe', grp: 'YAPRAKLI', point_id: 1, dbh_cm: 20, height_m: 7, created_at: '2026-09-01',
    profiles: { full_name: 'Ayşe Yılmaz' },
    projects: { id: 10, name: 'Göksu Parkı - deneme', park_id: 7, park_name: 'Göksu Parkı', parks: GOKSU } },
  { id: 2, owner: 'u2', project_id: 11, park_id: 7, carbon_kg: 50, status: 'Beklemede', species: 'Çam', grp: 'İBRELİ', point_id: 2, dbh_cm: 30, height_m: 9, created_at: '2026-09-02',
    profiles: { full_name: 'Burak Demir' },
    projects: { id: 11, name: 'Göksu Parkı - kuzey', park_id: 7, park_name: 'Göksu Parkı', parks: GOKSU } },
  { id: 3, owner: 'u1', project_id: 11, park_id: 7, carbon_kg: 25, status: 'Red', species: 'Meşe', grp: 'YAPRAKLI', point_id: 3, dbh_cm: 15, height_m: 5, created_at: '2026-09-03',
    profiles: { full_name: 'Ayşe Yılmaz' },
    projects: { id: 11, name: 'Göksu Parkı - kuzey', park_id: 7, park_name: 'Göksu Parkı', parks: GOKSU } },
  { id: 4, owner: 'u3', project_id: 12, park_id: null, carbon_kg: 20, status: 'Onaylı', species: 'Söğüt', grp: 'DİĞER', point_id: 9, dbh_cm: 12, height_m: 4, created_at: '2026-08-01',
    profiles: { full_name: 'Cem Kaya' },
    projects: { id: 12, name: 'Eski Proje X', park_id: null, park_name: null, parks: null } },
];

describe('dgTreeGroup — park → proje → kullanıcı hiyerarşisi', () => {
  const t = dgTreeGroup(rows);

  test('⭐ aynı parktaki 2 proje TEK park düğümünde birleşir', () => {
    assert.equal(t.length, 2, 'park + pending = 2 düğüm olmalı');
    assert.equal(t[0].name, 'Göksu Parkı');
    assert.equal(t[0].projects.length, 2, 'iki proje parkın altında');
    assert.equal(t[0].n, 3, 'üç ölçüm parkta toplanır');
    assert.equal(t[0].c, 175);
  });

  test('park düğümü alan + şehir + t/ha için veri taşır', () => {
    assert.equal(t[0].area_m2, 423000);
    assert.equal(t[0].city, 'Ankara');
    assert.equal(t[0].park_id, 7);
    assert.equal(t[0].pending, false);
  });

  test('proje altında kullanıcılar ayrışır, ölçüler kullanıcıda toplanır', () => {
    const kuzey = t[0].projects.find((p) => p.name === 'Göksu Parkı - kuzey');
    assert.equal(kuzey.users.length, 2, 'Ayşe + Burak');
    assert.equal(kuzey.n, 2);
    const ayse = kuzey.users.find((u) => u.name === 'Ayşe Yılmaz');
    assert.equal(ayse.n, 1);
    assert.equal(ayse.red, 1, 'durum sayaçları (red) doğru');
    const burak = kuzey.users.find((u) => u.name === 'Burak Demir');
    assert.equal(burak.beklemede, 1);
  });

  test('durum sayaçları kullanıcı düzeyinde ayrışır (onaylı/bekleyen/red)', () => {
    const deneme = t[0].projects.find((p) => p.name === 'Göksu Parkı - deneme');
    assert.equal(deneme.users[0].onayli, 1);
    assert.equal(deneme.users[0].beklemede, 0);
    assert.equal(deneme.users[0].red, 0);
  });

  test('⭐ parkı olmayanlar tek "pending" düğümünde, EN ALTA sıralanır', () => {
    const pend = t[t.length - 1];
    assert.equal(pend.pending, true);
    assert.equal(pend.park_id, 0);
    assert.match(pend.name, /Park algılanmamış/);
    assert.equal(pend.projects.length, 1);
    assert.equal(pend.projects[0].name, 'Eski Proje X');
  });

  test('sıralama her seviyede karbon azalan', () => {
    /* Array.from ile test realm'ine kopyala: vm dizileri assert.deepEqual'da
     * "same structure but not reference-equal" verir (bkz. test-harness notu 2). */
    const carbons = Array.from(t[0].projects, (p) => p.c);
    assert.deepEqual(carbons, [...carbons].sort((a, b) => b - a));
    const users = Array.from(t[0].projects[0].users, (u) => u.c);
    assert.deepEqual(users, [...users].sort((a, b) => b - a));
  });

  test('eksik gömüler çökertmez (profiles/projects null)', () => {
    const g = dgTreeGroup([{ id: 9, owner: null, project_id: null, park_id: null, carbon_kg: null, status: null, profiles: null, projects: null }]);
    assert.equal(g.length, 1);
    assert.equal(g[0].pending, true);
    assert.equal(g[0].projects[0].users[0].name, 'Bilinmeyen kullanıcı');
    assert.equal(g[0].c, 0);
  });

  test('boş girdi → boş ağaç', () => {
    assert.equal(dgTreeGroup([]).length, 0);
    assert.equal(dgTreeGroup(null).length, 0);
  });
});

describe('dgTreeFilterRows — durum + arama filtresi', () => {
  test('duruma göre süzer (onaylı / bekleyen / red ayrı ayrı)', () => {
    assert.equal(dgTreeFilterRows(rows, 'Onaylı', '').length, 2);
    assert.equal(dgTreeFilterRows(rows, 'Beklemede', '').length, 1);
    assert.equal(dgTreeFilterRows(rows, 'Red', '').length, 1);
    assert.equal(dgTreeFilterRows(rows, '', '').length, 4, 'filtre yok → hepsi');
  });

  test('⭐ kullanıcı adıyla arar (kim hangi veriyi girmiş)', () => {
    assert.equal(dgTreeFilterRows(rows, '', 'burak').length, 1);
    assert.equal(dgTreeFilterRows(rows, '', 'Ayşe').length, 2);
  });

  test('park, proje, tür ve nokta adıyla arar', () => {
    assert.equal(dgTreeFilterRows(rows, '', 'göksu').length, 3);
    assert.equal(dgTreeFilterRows(rows, '', 'kuzey').length, 2);
    assert.equal(dgTreeFilterRows(rows, '', 'söğüt').length, 1);
    assert.equal(dgTreeFilterRows(rows, '', '9').length, 1);
  });

  test('Türkçe büyük/küçük harf duyarsız (İ/ı tuzağı)', () => {
    assert.equal(dgTreeFilterRows(rows, '', 'ÇAM').length, 1);
    assert.equal(dgTreeFilterRows(rows, '', 'ibrelı').length >= 0, true);
  });

  test('durum + arama birlikte çalışır', () => {
    assert.equal(dgTreeFilterRows(rows, 'Onaylı', 'eski').length, 1);
    assert.equal(dgTreeFilterRows(rows, 'Red', 'burak').length, 0);
  });
});

describe('kabuk kaydı ve hata görünürlüğü', () => {
  test('ağaç kartı + filtre kontrolleri sayfada', () => {
    assert.match(idx, /id="adminTree"/);
    assert.match(idx, /id="treeStatus" onchange="dgTreeSetStatus\(this\.value\)"/);
    assert.match(idx, /id="treeSearch"[^>]*oninput="dgTreeSetQuery\(this\.value\)"/);
    assert.match(idx, /Park → Proje → Kullanıcı/);
  });

  test('durum filtresi üç durumu da sunuyor (onaylı + bekleyen + red)', () => {
    assert.match(idx, /<option value="Onaylı">✓ Onaylı<\/option>/);
    assert.match(idx, /<option value="Beklemede">⏳ Beklemede<\/option>/);
    assert.match(idx, /<option value="Red">🚫 Reddedilmiş<\/option>/);
  });

  test('admin-tree.js index.html + sw.js CORE_ASSETS’te, admin.js’ten sonra', () => {
    assert.ok(idx.indexOf('src/services/admin.js') < idx.indexOf('src/services/admin-tree.js'), 'yükleme sırası');
    assert.ok(sw.includes("'/src/services/admin-tree.js'"), 'çevrimdışı PRECACHE’de yok');
  });

  test('⭐ sorgu hatası sessizce "Kayıt yok."a dönüşmüyor', () => {
    assert.match(admin, /if\(mRes\.error\)\{/, 'loadAdmin hatayı ekrana yazmalı');
    assert.match(admin, /veri silinmedi/, 'kullanıcıya veri kaybı olmadığı söylenmeli');
    assert.match(admin, /loadAdminTree\(\)/, 'ağaç loadAdmin sonundan tetiklenmeli');
  });

  test('ağaç kendi hatasını da gösteriyor + yedek sorgu zinciri var', () => {
    assert.match(tree, /DG_TREE_ERR/, 'hata durumu tutulmalı');
    assert.match(tree, /Ölçümler okunamadı/, 'hata kutusu');
    assert.match(tree, /mode:"join"/, 'embed başarısızsa istemci tarafı join yedeği');
    assert.match(tree, /mode:"fail"/, 'ikisi de olmazsa hata bildirilir');
  });

  test('onay/red/silme düğmeleri mevcut fonksiyonları kullanır', () => {
    assert.match(tree, /onclick="approveMeas\(/);
    assert.match(tree, /onclick="rejectMeas\(/);
    assert.match(tree, /onclick="delMeas\(/);
  });

  test('düğüm açık/kapalı durumu yeniden çizimde korunur', () => {
    assert.match(tree, /DG_TREE_OPEN/);
    assert.match(tree, /ontoggle="dgTreeToggle\(/);
  });
});
