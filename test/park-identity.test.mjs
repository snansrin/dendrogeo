/* park-identity.test.mjs — PARK KİMLİĞİ + ÖLÇÜM KAPISI KİLİDİ (2026-09-24)
 *
 * Kullanıcı isteği: "Park Karşılaştırma sayfasında projelere verilen adlar
 * değil direkt algılanan parkların verisi gözüksün. 3 kişi Göksu Parkı'nda
 * çalıştıysa veriler proje olarak değil direkt Göksu Parkı olarak çıksın.
 * Ölçüm yapılacağı zaman direkt park algılama ekranına yönlendirsin. Park
 * algılandıktan sonra projenin adı park adı + kullanıcının belirlediği ad
 * olsun (Göksu Parkı - deneme). Yeni projede park algılama olmadan ölçüm
 * girilemesin."
 *
 * Bu istek DÖRT ayrı katmanda yaşıyor ve biri unutulursa özellik SESSİZCE
 * yarı çalışır (ör. karşılaştırma park bazlı ama ölçüm kapısı yok → yeni
 * parksız veriler birikmeye devam eder). Test bu yüzden dört katmanı da
 * ayrı ayrı kilitler:
 *
 *   1) SAF KURAL  — ad normalizasyonu, OSM anahtarı, "park - etiket" adı,
 *                   eski addan etiket çıkarma (vm'de gerçekten çalıştırılır)
 *   2) ŞEMA       — 0004_parks.sql: parks tablosu, park_id/label sütunları,
 *                   iki trigger, v_park_compare view'ı, RLS + grant
 *   3) KABUK      — parkGate / parkScanCard / pLabel / backfillBox id'leri,
 *                   onchange yönlendirmesi, modül yükleme sırası
 *   4) AKIŞ       — saveMeas kapısı, loadParkCompare'nin view'ı okuması,
 *                   drawPark'ın parkı kaydetmesi
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadApp } from '../scripts/test-harness.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const app = loadApp();
const {
  dgNormParkName, dgNormParkLoose, dgParkKey, dgManualParkKey,
  dgProjectName, dgLabelFromLegacy, dgParkMatchRadius, dgParkCenterFromRings,
  dgTitleCaseTR, dgSuggestParkName,
  DG_PARK_SEP, DG_PARK_MATCH_M,
} = app;

const sql = readFileSync(join(ROOT, 'supabase/migrations/0004_parks.sql'), 'utf8');
const idx = readFileSync(join(ROOT, 'index.html'), 'utf8');
const sw = readFileSync(join(ROOT, 'sw.js'), 'utf8');
const world = readFileSync(join(ROOT, 'src/services/world.js'), 'utf8');
const measure = readFileSync(join(ROOT, 'src/services/measure.js'), 'utf8');
const registry = readFileSync(join(ROOT, 'src/services/park-registry.js'), 'utf8');
const panel = readFileSync(join(ROOT, 'src/ui/park-panel.js'), 'utf8');

/* =========================================================
   1) SAF KURAL
========================================================= */
describe('park adı normalizasyonu (kimlik birleşmesinin temeli)', () => {
  test('Türkçe büyük/küçük harf + aksan katlanır', () => {
    assert.equal(dgNormParkName('GÖKSU PARKI'), 'goksu parki');
    assert.equal(dgNormParkName('Göksu Parkı'), 'goksu parki');
    assert.equal(dgNormParkName('goksu parki'), 'goksu parki');
  });

  test('⭐ "İ" tuzağı: JS toLowerCase("İ") birleşen nokta üretir, biz üretmiyoruz', () => {
    /* Bu, eşleştirmeyi sessizce bozan gerçek bir tuzak: "İ".toLowerCase()
     * → "i̇" (i + U+0307). İki ayrı anahtar üretir, aynı park iki kimlik olur. */
    assert.equal(dgNormParkName('İSTANBUL'), dgNormParkName('istanbul'));
    assert.ok(!dgNormParkName('İSTANBUL').includes('\u0307'), 'birleşen nokta kalmamalı');
    assert.equal(dgNormParkName('IHLAMUR'), dgNormParkName('ıhlamur'));
  });

  test('çoğul boşluk ve noktalama tek boşluğa iner', () => {
    assert.equal(dgNormParkName('  Göksu   Parkı — Kuzey  '), 'goksu parki kuzey');
  });

  test('boş/undefined güvenli', () => {
    assert.equal(dgNormParkName(''), '');
    assert.equal(dgNormParkName(null), '');
    assert.equal(dgNormParkName(undefined), '');
  });

  test('gevşek biçim "park/parkı" sözcüğünü yok sayar (ad varyasyonu birleşsin)', () => {
    assert.equal(dgNormParkLoose('Göksu Parkı'), dgNormParkLoose('Göksu Park'));
    assert.equal(dgNormParkLoose('Göksu Parkı'), 'goksu');
    assert.notEqual(dgNormParkLoose('Göksu Parkı'), dgNormParkLoose('Eymir Gölü'));
  });
});

describe('park anahtarı (canonical kimlik)', () => {
  test('OSM elemanı: tip/id — aynı park herkeste aynı anahtar', () => {
    assert.equal(dgParkKey('way', 123456), 'way/123456');
    assert.equal(dgParkKey('RELATION', '999'), 'relation/999');
    assert.equal(dgParkKey('way', 123456), dgParkKey('way', 123456));
    assert.notEqual(dgParkKey('way', 1), dgParkKey('relation', 1));
  });

  test('elle park: ad + ~100 m hücresi', () => {
    const k = dgManualParkKey('Göksu Parkı', 39.98761, 32.65437);
    assert.equal(k, 'manual/goksu parki/39.988/32.654');
    /* Aynı hücre içindeki ikinci nokta → AYNI anahtar (çift kimlik açılmaz) */
    assert.equal(k, dgManualParkKey('GÖKSU PARKI', 39.98764, 32.65439));
    /* Farklı şehirdeki aynı ad → farklı anahtar (doğru: iki ayrı park) */
    assert.notEqual(k, dgManualParkKey('Göksu Parkı', 41.01, 28.98));
  });

  test('koordinat yoksa anahtar yine deterministik', () => {
    assert.equal(dgManualParkKey('X', null, undefined), 'manual/x/yok');
  });
});

describe('proje adı kuralı: "park adı - etiket"', () => {
  test('⭐ kullanıcının verdiği biçim birebir üretilir', () => {
    assert.equal(dgProjectName('Göksu Parkı', 'deneme'), 'Göksu Parkı - deneme');
  });

  test("ayraç sabiti DB trigger'ıyla aynı", () => {
    assert.equal(DG_PARK_SEP, ' - ');
    assert.ok(sql.includes(`pk_name || ' - ' || lbl`), 'SQL tarafı da " - " kullanmalı');
  });

  test('etiket boşsa ad = park adı', () => {
    assert.equal(dgProjectName('Göksu Parkı', ''), 'Göksu Parkı');
    assert.equal(dgProjectName('Göksu Parkı', '   '), 'Göksu Parkı');
  });

  test('etiket kırpılır', () => {
    assert.equal(dgProjectName('Göksu Parkı', '  deneme  '), 'Göksu Parkı - deneme');
  });

  test('park adı yoksa etiket tek başına (şema yedeği çökmesin)', () => {
    assert.equal(dgProjectName('', 'deneme'), 'deneme');
  });
});

describe('eski proje adından etiket çıkarma (geri doldurma)', () => {
  test('yeni biçimdeki ad → etiket', () => {
    assert.equal(dgLabelFromLegacy('Göksu Parkı - deneme', 'Göksu Parkı'), 'deneme');
    assert.equal(dgLabelFromLegacy('Göksu Parkı-deneme', 'Göksu Parkı'), 'deneme');
  });

  test('ad zaten park adı → boş etiket', () => {
    assert.equal(dgLabelFromLegacy('Göksu Parkı', 'Göksu Parkı'), '');
    assert.equal(dgLabelFromLegacy('göksu parkı', 'Göksu Parkı'), '');
  });

  test('⭐ park adıyla ilgisi olmayan ESKİ AD KAYBOLMAZ → etiket olur', () => {
    assert.equal(
      dgProjectName('Göksu Parkı', dgLabelFromLegacy('Kuzey Kesim Envanteri', 'Göksu Parkı')),
      'Göksu Parkı - Kuzey Kesim Envanteri'
    );
  });

  test('park adı yoksa ad olduğu gibi kalır', () => {
    assert.equal(dgLabelFromLegacy('Kuzey Kesim', ''), 'Kuzey Kesim');
    assert.equal(dgLabelFromLegacy('Kuzey Kesim', null), 'Kuzey Kesim');
  });
});

describe('eşleştirme yarıçapı + temsil noktası', () => {
  test('⭐ taban 400 m; büyük parkta sqrt(alan) (canlıdaki çift kimlik dersi)', () => {
    /* 2026-09-24: canlıda aynı Göksu Parkı iki kimlikle kaydedildi (elle #1 +
     * OSM way/423602737 #2). 50 ha park ~707 m kenar; eski yarıçap 354 m
     * olduğu için elle tıklanan nokta OSM merkeziyle eşleşmedi. Yeni kural:
     * sqrt(alan) → 50 ha için ~707 m. */
    assert.equal(DG_PARK_MATCH_M, 400);
    assert.equal(dgParkMatchRadius(null), 400);
    assert.equal(dgParkMatchRadius(0), 400);
    const r50 = dgParkMatchRadius(500000);
    assert.ok(r50 > 700 && r50 < 715, 'r=' + r50);
    const r40 = dgParkMatchRadius(400000);
    assert.ok(r40 > 630 && r40 < 635, 'r=' + r40);
    /* 1 ha → tabanın altında kalmaz */
    assert.equal(dgParkMatchRadius(10000), 400);
  });

  test('Türkçe duyarlı başlık düzeni (DB\'deki dg_tr_title ile aynı)', () => {
    assert.equal(dgTitleCaseTR('göksu parkı'), 'Göksu Parkı');
    assert.equal(dgTitleCaseTR('işçi parkı'), 'İşçi Parkı');
    assert.equal(dgTitleCaseTR('ıhlamur vadisi'), 'Ihlamur Vadisi');
    assert.equal(dgTitleCaseTR('KOCAELİ PARK'), 'KOCAELİ PARK', 'büyük harfli ad bozulmaz');
    assert.equal(dgTitleCaseTR('  çok   boşluk  '), 'Çok Boşluk');
    assert.equal(dgTitleCaseTR(''), '');
  });

  test('adsız OSM elemanı için proje adından öneri', () => {
    assert.equal(dgSuggestParkName('afyon çocuk parkı'), 'Afyon Çocuk Parkı');
    assert.equal(dgSuggestParkName('Afyon Çocuk parkı'), 'Afyon Çocuk parkı', 'zaten büyük harf içeriyor → dokunma');
    assert.equal(dgSuggestParkName(''), 'İsimsiz Park');
    assert.equal(dgSuggestParkName(null), 'İsimsiz Park');
  });

  test('halkalardan bbox merkezi ([lat,lon] sözleşmesi)', () => {
    const c = dgParkCenterFromRings([[[39.9, 32.6], [40.0, 32.7], [40.0, 32.6], [39.9, 32.6]]]);
    assert.equal(c.lat, 39.95);
    assert.equal(c.lon, 32.65);
  });

  test('relation biçimi {outer,inner} de çalışır', () => {
    const c = dgParkCenterFromRings({ outer: [[[0, 0], [2, 4]]], inner: [] });
    assert.equal(c.lat, 1);
    assert.equal(c.lon, 2);
  });

  test('geçersiz girdi → null (patlama yok)', () => {
    assert.equal(dgParkCenterFromRings(null), null);
    assert.equal(dgParkCenterFromRings([]), null);
    assert.equal(dgParkCenterFromRings({}), null);
  });
});

/* =========================================================
   2) ŞEMA (0004_parks.sql)
========================================================= */
describe('migration 0004: park kimliği şeması', () => {
  test('parks tablosu + canonical UNIQUE anahtar', () => {
    assert.match(sql, /create table if not exists public\.parks/);
    assert.match(sql, /osm_key\s+text not null/);
    assert.match(sql, /constraint parks_osm_key_unique unique \(osm_key\)/);
    assert.match(sql, /name_norm\s+text not null/);
    assert.match(sql, /centroid_lat double precision/);
    assert.match(sql, /area_m2\s+double precision/);
  });

  test('projects.park_id + label + park_name sütunları', () => {
    assert.match(sql, /alter table public\.projects[\s\S]{0,120}add column if not exists park_id\s+bigint references public\.parks\(id\)/);
    assert.match(sql, /add column if not exists park_name text/);
    assert.match(sql, /add column if not exists label\s+text/);
    assert.match(sql, /create index if not exists idx_projects_park/);
  });

  test('measurements.park_id (denormalize) + mevcut verinin doldurulması', () => {
    assert.match(sql, /alter table public\.measurements[\s\S]{0,80}add column if not exists park_id/);
    assert.match(sql, /update public\.measurements m[\s\S]{0,200}set park_id = p\.park_id/);
  });

  test('⭐ proje adını DB kurar: trg_compose_project_name', () => {
    assert.match(sql, /create or replace function public\.compose_project_name\(\)/);
    assert.match(sql, /create trigger trg_compose_project_name\s+before insert or update on public\.projects/);
    /* Etiket boşsa ad = park adı (çift ayraç üretilmez) */
    assert.match(sql, /when lbl = '' then pk_name/);
  });

  test('⭐ ölçüm kapısı: trg_enforce_park_link → PARK_REQUIRED', () => {
    assert.match(sql, /create or replace function public\.enforce_park_link\(\)/);
    assert.match(sql, /create trigger trg_enforce_park_link\s+before insert or update on public\.measurements/);
    assert.match(sql, /PARK_REQUIRED/);
  });

  test("kapı UPDATE'te eski kayıtları kilitlemez (onay akışı bozulmasın)", () => {
    /* Admin, park bağı olmayan ESKİ bir ölçümü onaylarken trigger patlamamalı. */
    assert.match(sql, /tg_op = 'UPDATE' and new\.project_id is not distinct from old\.project_id/);
  });

  test("⭐ karşılaştırma view'ı park bazında gruplar", () => {
    assert.match(sql, /create view public\.v_park_compare with \(security_invoker=true\)/);
    assert.match(sql, /count\(distinct m\.owner\)::integer\s+as contributors/);
    assert.match(sql, /count\(distinct m\.project_id\)::integer\s+as projects/);
    /* Parkı olmayanlar kaybolmaz: park_id=0 + park_pending */
    assert.match(sql, /coalesce\(pk\.id, 0\)::bigint\s+as park_id/);
    assert.match(sql, /bool_or\(pk\.id is null\)\s+as park_pending/);
    /* Gruplama park kimliğine göre → 3 proje tek satır */
    assert.match(sql, /group by coalesce\(pk\.id, 0\)::bigint, coalesce\(pk\.name, pr\.name, '—'\)/);
    assert.match(sql, /where m\.status = 'Onaylı' and m\.deleted_at is null/);
  });

  test('RLS: parks herkese açık okunur, yazma girişli + aktif kullanıcıya', () => {
    assert.match(sql, /alter table public\.parks enable row level security/);
    assert.match(sql, /create policy parks_select on public\.parks for select\s+to anon, authenticated using \(true\)/);
    assert.match(sql, /create policy parks_insert on public\.parks for insert to authenticated\s+with check \(created_by = auth\.uid\(\) and public\.is_active\(\)\)/);
    assert.match(sql, /create policy parks_delete on public\.parks for delete to authenticated\s+using \(public\.is_admin\(\)\)/);
    assert.match(sql, /grant select on public\.parks to anon, authenticated/);
    assert.match(sql, /grant select on public\.v_park_compare to authenticated/);
    /* anon'a grant YOK: view security_invoker, anon projects'i okuyamaz →
     * grant vermek "permission denied" hatası üretir (PostgreSQL 15'te doğrulandı). */
    assert.match(sql, /revoke select on public\.v_park_compare from anon/);
  });

  test('admin geri doldurma aracı için projects_update politikası genişletildi', () => {
    assert.match(sql, /create policy projects_update on public\.projects for update to authenticated\s+using \(owner = auth\.uid\(\) or public\.is_owner\(\) or public\.is_admin\(\)\)/);
  });

  test('migration idempotent (tekrar çalıştırılabilir)', () => {
    const creates = (sql.match(/create table if not exists/g) || []).length;
    assert.ok(creates >= 1, 'create table if not exists kullanılmalı');
    assert.ok(!/create table public\.parks\b/.test(sql), 'IF NOT EXISTS olmadan tablo yaratma');
    assert.ok((sql.match(/drop policy if exists/g) || []).length >= 4, 'politikalar drop-if-exists ile yenilenmeli');
    assert.ok((sql.match(/drop trigger if exists/g) || []).length >= 2, 'trigger’lar drop-if-exists ile yenilenmeli');
    assert.match(sql, /drop view if exists public\.v_park_compare/);
  });
});

describe('migration 0005: park adı yazım düzeni (Türkçe duyarlı)', () => {
  const sql5 = readFileSync(join(ROOT, 'supabase/migrations/0005_park_name_case.sql'), 'utf8');

  test('dg_tr_title Türkçe harfleri ELLE eşler (initcap ASCII yereli bozar)', () => {
    assert.match(sql5, /create or replace function public\.dg_tr_title/);
    assert.match(sql5, /when left\(w,1\) = 'i' then 'İ'/);
    assert.match(sql5, /when left\(w,1\) = 'ı' then 'I'/);
    /* initcap('işçi') → 'Işçi' (yanlış); bu yüzden ad düzeltmesinde kullanılmaz.
     * Yorumlar VE string literalleri (COMMENT ON metni initcap'ten söz eder)
     * ayıklandıktan sonra çalışan SQL'de initcap çağrısı olmamalı. */
    const exec5 = sql5.replace(/--[^\n]*/g, '').replace(/'[^']*'/g, "''");
    assert.ok(!/initcap\s*\(/.test(exec5), 'çalışan SQL initcap kullanmamalı');
  });

  test('⭐ tetikleyici yalnız TAMAMEN küçük harfli adları düzeltir (veri ezmez)', () => {
    assert.match(sql5, /create trigger trg_park_name_case\s+before insert or update of name on public\.parks/);
    assert.match(sql5, /new\.name !~ '\[A-ZİIŞĞÜÖÇ\]'/);
  });

  test('mevcut parklar + proje adları onarılır', () => {
    assert.match(sql5, /update public\.parks\s+set name = public\.dg_tr_title\(name\)/);
    /* projects.name'e doğrudan dokunulmaz: trg_compose_project_name (0004)
     * park_name tazelenince adı zaten yeniden kurar — tek kaynak kuralı. */
    assert.match(sql5, /update public\.projects p\s+set park_name = pk\.name/);
    assert.ok(!/update public\.projects[\s\S]{0,80}set name\s*=/.test(sql5), 'proje adı elle yazılmamalı');
  });

  test('name_norm DEĞİŞMEZ (park eşleştirmesi bozulmasın)', () => {
    assert.ok(!/set name_norm/.test(sql5), 'name_norm güncellenmemeli');
    assert.match(sql5, /name_norm/); /* belgelenmiş olmalı */
  });

  test('idempotent', () => {
    assert.match(sql5, /create or replace function/);
    assert.match(sql5, /drop trigger if exists trg_park_name_case/);
  });
});

describe('park kimlikleri yönetim aracı (yeniden adlandır · birleştir · sil)', () => {
  test('kart + kontroller sayfada', () => {
    assert.match(idx, /id="parkAdminBox"/);
    assert.match(idx, /onclick="loadParkAdmin\(\)"/);
    assert.match(idx, /<h2 style="font-size:1\.2rem">Park Kimlikleri<\/h2>/);
  });

  test('yönetim sekmesi açılınca park kimlikleri de yüklenir', () => {
    assert.match(readFileSync(join(ROOT, 'src/services/admin.js'), 'utf8'), /loadParkAdmin\(\)/);
  });

  test('birleştirme projeleri + ölçümleri taşır, kaynağı siler', () => {
    const fn = registry.slice(registry.indexOf('async function dgParkMergeInto'), registry.indexOf('async function dgParkDelete'));
    assert.match(fn, /from\("projects"\)\.update\(\{park_id:dstId\}\)\.eq\("park_id",srcId\)/);
    assert.match(fn, /from\("measurements"\)\.update\(\{park_id:dstId\}\)\.eq\("park_id",srcId\)/);
    assert.match(fn, /from\("parks"\)\.delete\(\)\.eq\("id",srcId\)/);
    assert.match(fn, /dgResyncProjectNames\(dstId\)/, 'proje adları hedef park adına göre kurulmalı');
    assert.match(fn, /confirm\(/, 'onay istenmeli (kaynak kimlik siliniyor)');
  });

  test('yeniden adlandırma name_norm’u da günceller (eşleştirme bozulmasın)', () => {
    const fn = registry.slice(registry.indexOf('async function dgParkRename'), registry.indexOf('function dgParkMergeFromSelect'));
    assert.match(fn, /name_norm:dgNormParkName\(name\)/);
    assert.match(fn, /dgResyncProjectNames\(id,name\)/, 'yeni ad doğrudan taşınmalı (ikinci sorgu/yarış olmasın)');
  });

  test('⭐ otomatik birleştirme YOK (aynı adlı iki ayrı park olabilir)', () => {
    assert.ok(!/dgAutoMerge|autoMergeParks/.test(registry), 'sessiz birleştirme eklenmemeli');
    assert.match(registry, /çift kimlik adayı var/i, 'araç yalnız ÖNERİR, kararı yönetici verir');
  });
});

/* =========================================================
   3) KABUK (index.html + modül kaydı)
========================================================= */
describe('kabuk: park algılama ekranı + ölçüm kapısı id’leri', () => {
  test('ölçüm ekranında kapı kartı var', () => {
    assert.match(idx, /id="parkGate"/);
  });

  test('canlı haritada park algılama kartı var (map’ten ÖNCE)', () => {
    assert.match(idx, /id="parkScanCard"/);
    assert.ok(idx.indexOf('id="parkScanCard"') < idx.indexOf('id="mapLoad"'), 'kart haritanın üstünde olmalı');
  });

  test('⭐ proje formu artık PARK + ETİKET (serbest "Proje Adı" alanı yok)', () => {
    assert.match(idx, /id="pLabel"/);
    assert.match(idx, /id="pNamePreview"/);
    assert.match(idx, /id="projParkBox"/);
    assert.ok(!/id="pName"/.test(idx), 'serbest proje adı alanı kaldırılmalı');
    assert.match(idx, /Proje Adı \(otomatik\)/);
  });

  test('yönetimde geri doldurma aracı var', () => {
    assert.match(idx, /onclick="backfillParks\(\)"/);
    assert.match(idx, /id="backfillBox"/);
  });

  test('proje seçimi değişince kapı tazelenir', () => {
    assert.match(idx, /id="mProject" onchange="dgProjectChanged\(\)"/);
  });

  test('park tablosu "Park" sütunu içeriyor', () => {
    assert.match(idx, /<th>ID<\/th><th>Park<\/th><th>Proje Adı<\/th>/);
  });

  test('⭐ park-registry.js yükleme sırası: park-query → registry → grid-engine', () => {
    const a = idx.indexOf('src/services/park-query.js');
    const b = idx.indexOf('src/services/park-registry.js');
    const c = idx.indexOf('src/services/grid-engine.js');
    assert.ok(a > -1 && b > -1 && c > -1, 'üç modül de index.html’de olmalı');
    assert.ok(a < b && b < c, `sıra bozuk: query=${a} registry=${b} grid=${c}`);
  });

  test('park-registry.js service worker PRECACHE listesinde (çevrimdışı)', () => {
    assert.ok(sw.includes("'/src/services/park-registry.js'"), 'CORE_ASSETS’te yok');
  });
});

/* =========================================================
   4) AKIŞ
========================================================= */
describe('akış: karşılaştırma park bazlı, ölçüm kapalı, park kaydediliyor', () => {
  test('⭐ loadParkCompare v_park_compare’den okuyor (proje adı değil)', () => {
    assert.match(world, /sb\.from\("v_park_compare"\)/);
    /* Sıralama artık ham ölçüm satırlarından proje adına göre yapılmıyor:
     * eski kod `const name=r.projects?.name` ile gruplardı. */
    const fn = world.slice(world.indexOf('async function loadParkCompare'), world.indexOf('function dgParkRowHTML'));
    assert.ok(!/r\.projects\?\.name/.test(fn), 'ana yol hâlâ proje adına göre grupluyor');
    assert.match(world, /contributors/, 'katılımcı sayısı gösterilmeli');
  });

  test('karşılaştırma park_pending kayıtlarını AYRI bölümde tutar (veri kaybolmaz)', () => {
    assert.match(world, /dgPendingParksHTML/);
    assert.match(world, /PARK ALGILANMAMIŞ KAYITLAR/);
  });

  test('şema eskiyse proje bazlı yedeğe düşer + migration’ı söyler', () => {
    assert.match(world, /loadParkCompareLegacy/);
    assert.match(world, /0004_parks\.sql/);
  });

  test('⭐ park raporu park_id üzerinden tüm projeleri toplar', () => {
    assert.match(world, /projects!inner\(/);
    assert.match(world, /\.eq\("projects\.park_id",row\.park_id\)/);
  });

  test('⭐ saveMeas parkı olmayan projede ölçümü reddedip algılamaya yönlendirir', () => {
    assert.match(measure, /if\(DG_PARK_SCHEMA_OK&&!EDIT_ID&&\(!gateProj\|\|!gateProj\.park_id\)\)/);
    assert.match(measure, /startParkScan\(\{projectId:pid\|\|null,returnTo:"measure"\}\)/);
  });

  test('ölçüm satırına park_id yazılır (denormalize)', () => {
    assert.match(measure, /if\(DG_PARK_SCHEMA_OK\)base\.park_id=\(gateProj&&gateProj\.park_id\)\|\|null;/);
  });

  test('proje oluşturma park olmadan engellenir', () => {
    const fn = measure.slice(measure.indexOf('async function createProject'), measure.indexOf('async function deleteProject'));
    assert.match(fn, /const park=DG_PARK;/);
    assert.match(fn, /park olmadan proje açılamaz/);
    assert.match(fn, /startParkScan\(\{returnTo:"projects"\}\)/);
  });

  test('⭐ drawPark algılanan parkı kimliğe yazdırır', () => {
    assert.match(panel, /dgOnParkDrawn\(park\)/);
    assert.match(panel, /dgParkIdChip\(parkRow\)/);
    /* Grid/waypoint proje listesi yalnız bu parkın projeleri */
    assert.match(panel, /dgProjectOptionsForPark\(parkRow\?parkRow\.id:null,true\)/);
  });

  test('harita tıklaması tek algılama yolundan geçer (elle park teklifi dahil)', () => {
    assert.match(panel, /await dgDetectAt\(e\.latlng\.lat,e\.latlng\.lng\)/);
    assert.match(registry, /dgOfferManualPark\(/);
  });

  test('clearPark oturum kimliğini düşürür (proje bağı DB’de kalır)', () => {
    assert.match(panel, /dgResetParkIdentity\(\)/);
    const fn = registry.slice(registry.indexOf('function dgResetParkIdentity'), registry.indexOf('/* drawPark()'));
    assert.match(fn, /DG_PARK=null/);
  });

  test('gate ölçüm butonunu gerçekten kilitler (disabled)', () => {
    const fn = registry.slice(registry.indexOf('function dgParkGate'), registry.indexOf('/* Proje seçimi değişti'));
    assert.match(fn, /save\.disabled=true/);
    assert.match(fn, /save\.disabled=false/);
    /* Düzenleme modu kilitlenmez: mevcut kaydı güncellemek yeni ölçüm değil */
    assert.match(fn, /editing/);
  });

  test('şema eskiyse kapı ölçümü KİLİTLEMEZ (kullanıcı çalışamaz kalmasın)', () => {
    const fn = registry.slice(registry.indexOf('function dgParkGate'), registry.indexOf('/* Proje seçimi değişti'));
    assert.match(fn, /if\(!DG_PARK_SCHEMA_OK\)\{/);
  });

  test('park kaydı upsert DEĞİL select→insert (RLS: başkasının satırını yazma)', () => {
    const fn = registry.slice(registry.indexOf('async function dgRegisterPark'), registry.indexOf('/* =========================================================\n   4. ALGILAMA'));
    assert.ok(!/\.upsert\(/.test(fn), 'upsert RLS update politikasına takılır');
    assert.match(fn, /23505/, 'yarış durumunda duplicate key ele alınmalı');
    assert.match(registry, /dgSelectParkNear/, 'ad + konum birleşmesi olmalı');
  });
});
