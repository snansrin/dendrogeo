/* publish-request-fix.test.mjs — 0014 sözleşmeleri
 * Kök hata: işlenmiş istekler DB'de 'Beklemede' kalır (Actions'ın yazma
 * yetkisi yok) + unique index onları da sayar → ikinci yayın kalıcı bloke.
 * Kilitlenen çözüm: index kalkar; çift üretim koruması panel + planQueue
 * üzerinde (request_id ⇔ git günlüğü) yaşamaya DEVAM eder. */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

describe('0014 · migration: unique index kalkar, koruma katmanları kalır', () => {
  const sql = read('supabase/migrations/0014_publish_request_fix.sql');
  test('index düşürülür (idempotent, tek transaction)', () => {
    assert.match(sql, /drop index if exists public\.report_requests_one_pending_per_park/);
    assert.match(sql, /^begin;/m);
    assert.match(sql, /^commit;/m);
  });
  test('kök neden belgelenir: Actions yazamaz → satırlar kapanmaz', () => {
    assert.match(sql, /YAZMA yetkisi YOK/, 'güvenlik tasarımı gerekçesi dosyada');
    assert.match(sql, /dgPubEntryFor|panel/, 'koruma katmanı 1: panel');
    assert.match(sql, /planQueue/, 'koruma katmanı 2: kuyruk');
  });
  test('0008 hâlâ index OLUŞTURUYOR (taze kurulum sırası önemli değil: 0014 sonra koşar)', () => {
    const m8 = read('supabase/migrations/0008_report_publish.sql');
    assert.match(m8, /create unique index if not exists report_requests_one_pending_per_park/);
    const rm = read('supabase/README.md');
    const i8 = rm.indexOf('0008_report_publish.sql` → Run');
    const i14 = rm.indexOf('0014_publish_request_fix.sql` → Run');
    assert.ok(i8 > 0 && i14 > i8, 'README uygulama sırası: 0008 → … → 0014');
  });
});

describe('0014 · çift üretim koruması kodda duruyor (regresyon kilidi)', () => {
  test('panel: sonuçsuz veya başarısız Beklemede istekleri gösterir; başarılı sonucu tekrar kuyruğa sokmaz', () => {
    const ui = read('src/services/report-publish.js');
    assert.match(ui, /return !prev\|\|prev\.status==="Başarısız"/, 'park kartı başarısız isteği yeniden deneme olarak gösterir');
    assert.match(ui, /return !e\|\|e\.status==="Başarısız"/, 'bekleyen sayacı başarısız isteği kuyrukta tutar');
    assert.match(ui, /e\.status==="Yayınlandı"/, 'başarılı günlük kaydı yayın durumuna geçer');
  });
  test('planQueue: request_id günlükte olan istek atlanır (already)', () => {
    const q = read('scripts/publish-queue.mjs');
    assert.match(q, /request_id/, 'günlük ⇔ istek eşleşmesi');
    assert.match(q, /already/, 'atlanan sayaç');
  });
});
