/* heartbeat.test.mjs — 0016 kendi kendini süren kuyruk sözleşmeleri
 * Kullanıcı standardı (28.09.2026): "biz push etmediğimiz sürece ne geri
 * çekiyor ne yayın yapıyor — adam gibi sistem kur." Kilitlenen tasarım:
 *  · zincir: her koşu ardılını ~5 dk sonraya kendisi kaydeder (delayed dispatch)
 *  · yedekler: 5 dakikalık cron + 6 saatlik re-arm + CI push tetiği + rapor-yayin zinciri
 *  · boşta maliyet düşük: iş yoksa ağır üretim koşmaz (yalnız HTTP kontrolü)
 *  · tek üretici: üretim rapor-yayin.yml'e devredilir (concurrency kilidi orada) */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

describe('0016 · rapor-kalp.yml (kendi kendini süren nabız)', () => {
  const y = read('.github/workflows/rapor-kalp.yml');
  test('tetikler: zincir (repository_dispatch) + iki cron yedeği + elle', () => {
    assert.match(y, /types: \[rapor-kuyruk-nabiz\]/, 'zincir olayı');
    assert.match(y, /cron: '\*\/5 \* \* \* \*'/, '5 dk yedek cron');
    assert.match(y, /cron: '17 \*\/6 \* \* \*'/, '6 saatlik yeniden-arme');
    assert.match(y, /workflow_dispatch/, 'elle tetik');
  });
  test('boşta koşu ucuz: kuyruk denetimi YALNIZ HTTP (anon okuma)', () => {
    assert.match(y, /report_requests\?status=eq\.Beklemede/);
    assert.match(y, /report_retractions\?status=eq\.Beklemede/);
    assert.match(y, /yayin-kuyrugu\.json/, 'günlükteki request_id/retraction_id eşleşmesi');
  });
  test("üretim yalnız iş varsa ve kilit boşsa; iş rapor-yayin.yml’e devredilir", () => {
    assert.match(y, /if: steps\.kontrol\.outputs\.work != '0'/);
    assert.match(y, /uretim_yuruyor == '0'/, 'çift üretici koruması (in_progress/queued denetimi)');
    assert.match(y, /workflows\/rapor-yayin\.yml\/dispatches/, 'tek üretici: rapor-yayin (concurrency orada)');
    assert.match(y, /exclude_current=true/, 'kendi koşusunu saymaz');
  });
  test('zincir: ANLIK repository_dispatch + bekçi döngüsü (0017)', () => {
    // 0016'nın 'delay_minutes'li ertelenmiş dispatch'i bu depoda HİÇ koşmadı
    // (gözlem: kalp 0 koşu) → 0017: anlık repository_dispatch (saniyeler
    // içinde koştuğu 20:17 bot dispatch'iyle kanıtlı) + 4 dk bekçi (zincir
    // çoğalmaz, tekilleşir) + doğrulama döngüsü (son koşu zinciri devraldı mı).
    assert.match(y, /name: Zincir/);
    assert.match(y, /if: always/, 'üretim patlasa da zincir sürer');
    assert.match(y, /timeout-minutes: 55/, 'bekçi döngüsü işi kilitlemez');
    assert.match(y, /\$API\/dispatches/, 'anlık repository_dispatch');
    assert.match(y, /rapor-kuyruk-nabiz/, 'zincir olay adı');
    assert.match(y, /-ge 4/, 'bekçi: son 4 dk içinde koşu varsa tetik atma');
    assert.match(y, /seq 1 12/, 'doğrulama döngüsü (12 × 4 dk gözlem)');
    assert.ok(!/delay_minutes/.test(y), 'ertelenmiş dispatch kaldırıldı (güvenilmez çıktı)');
  });
  test('yetkiler minimal: actions write (zincir) + contents read', () => {
    assert.match(y, /actions: write/);
    assert.match(y, /contents: read/);
  });
});

describe('0016 · zincir halkaları diğer koşucularda da var', () => {
  test('rapor-yayin.yml: actions write + kapanışta ANLIK kalp tetiği', () => {
    const y = read('.github/workflows/rapor-yayin.yml');
    assert.match(y, /actions: write/);
    assert.match(y, /Kalp atışını başlat/);
    assert.match(y, /\$\{\{ github\.api_url \}\}\/repos\/\$\{\{ github\.repository \}\}\/dispatches/);
    assert.match(y, /rapor-kuyruk-nabiz/);
    const i = y.indexOf('Kalp atışını başlat');
    assert.match(y.slice(i, i + 140), /if: always/, 'üretim patlasa da zincir kırılmasın');
  });
  test('ci.yml kuyruk işi: actions write + anlık kalp tetiği (push kalbi başlatır)', () => {
    const y = read('.github/workflows/ci.yml');
    assert.match(y, /actions: write/);
    assert.match(y, /Kalp atışını başlat/);
    assert.match(y, /rapor-kuyruk-nabiz/);
    assert.match(y, /group: rapor-yayin-kuyrugu/, 'üretim kilidi korunuyor');
  });
});

describe('0016 · nabız kararı (aynı mantık, birim düzeyinde)', () => {
  /* Workflow'daki node -e bloğunun SAF kopyası: günlük + bekleyenler → iş var mı?
   * Sözleşme: request_id/retraction_id günlükte olan istekler iş SAYILMAZ
   * (bayat 'Beklemede' satırları sonsuz üretim tetikleyemez — 0014 dersi). */
  const decide = (log, reqs, rets) => {
    const doneReq = new Set((log.entries || []).map((e) => String(e.request_id)));
    const doneRet = new Set((log.entries || []).filter((e) => e.status === 'Geri çekildi').map((e) => String(e.retraction_id)));
    const pendReq = reqs.filter((r) => !doneReq.has(String(r.id))).length;
    const pendRet = rets.filter((r) => !doneRet.has(String(r.id))).length;
    return { work: pendReq + pendRet, pendReq, pendRet };
  };
  test('işlenmiş istek yeniden iş sayılmaz (bayat Beklemede zararsız)', () => {
    const log = { entries: [{ request_id: 'r1', status: 'Yayınlandı', report_id: 'DGR-2026-0004' }] };
    assert.equal(decide(log, [{ id: 'r1' }], []).work, 0);
  });
  test('yeni istek iş sayılır', () => {
    const log = { entries: [{ request_id: 'r1', status: 'Yayınlandı' }] };
    assert.equal(decide(log, [{ id: 'r1' }, { id: 'r2' }], []).work, 1);
  });
  test('geri çekme: günlükte retraction_id yoksa iş sayılır, varsa sayılmaz', () => {
    const rets = [{ id: 'x1', report_id: 'DGR-2026-0004' }];
    assert.equal(decide({ entries: [] }, [], rets).work, 1);
    const done = { entries: [{ status: 'Geri çekildi', retraction_id: 'x1', report_id: 'DGR-2026-0004' }] };
    assert.equal(decide(done, [], rets).work, 0);
  });
  test('bozuk/eksik günlük çökertmez (tüm istekler iş sayılır → güvenli taraf)', () => {
    assert.equal(decide({}, [{ id: 'r9' }], []).work, 1);
  });
});
