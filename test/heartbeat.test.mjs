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
  test('zincir (0022): kalp KENDİNİ değil BAYRAKI tetikler (GitHub özyineleme yasağı)', () => {
    // CANLI KANIT (29.09.2026): kalp'in kendine dispatch'i 202 almasına
    // rağmen HİÇ koşu oluşturmuyordu (15:38/15:51/16:16 — adımlar success,
    // ardıl koşu yok). Farklı workflow'u tetiklemek kanıtlı çalışıyor
    // (kalp→rapor-yayin 15:27:15 · rapor-yayin→kalp 15:27:38).
    // 0022: kalp → rapor-bayrak → kalp (iki bacak da farklı-workflow).
    assert.match(y, /name: "Zincir İLK iş/, 'zincir ilk adım');
    const iz = y.indexOf('Zincir İLK iş');
    const ik = y.indexOf('Kuyrukta iş var mı?');
    assert.ok(iz > 0 && ik > iz, 'zincir, iş kontrolünden ÖNCE');
    assert.match(y, /sleep 300/, 'ritim uykusu');
    assert.match(y, /timeout-minutes: 8/, 'uyku iş timeoutuna sığar');
    assert.match(y, /rapor-kalp-bayrak/, 'hedef: bayrak workflow');
    assert.ok(!/"event_type":"rapor-kuyruk-nabiz"/.test(y), 'kalp KENDİ olayını tetiklemez (GitHub düşürüyor)');
    assert.match(y, /zincir DOĞRULANDI/, 'dispatch sonrası koşu oluşumu doğrulanır (202 ≠ koşu dersi)');
    assert.match(y, /240000/, 'devir penceresi (yalnız YENİ koşular susturur)');
    assert.ok(!/delay_minutes/.test(y), 'gecikmeli dispatch YOK');
  });
  test('yetkiler minimal: actions write (zincir) + contents read', () => {
    assert.match(y, /actions: write/);
    assert.match(y, /contents: read/);
  });
});

describe('0016 · zincir halkaları diğer koşucularda da var', () => {
  test('rapor-yayin.yml: actions write + kapanışta BAYRAK tetiği', () => {
    const y = read('.github/workflows/rapor-yayin.yml');
    assert.match(y, /actions: write/);
    assert.match(y, /Kalp atışını başlat/);
    assert.match(y, /rapor-kalp-bayrak/, 'bacak bayrak üzerinden (farklı-workflow kuralı)');
    const i = y.indexOf('Kalp atışını başlat');
    assert.match(y.slice(i, i + 140), /if: always/, 'üretim patlasa da zincir kırılmasın');
  });
  test('ci.yml kuyruk işi: actions write + BAYRAK tetiği (push zinciri canlandırır)', () => {
    const y = read('.github/workflows/ci.yml');
    assert.match(y, /actions: write/);
    assert.match(y, /Kalp atışını başlat/);
    assert.match(y, /rapor-kalp-bayrak/);
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


describe('0022/0023 · rapor-bayrak.yml (zincir bayrağı — sertleştirilmiş)', () => {
  const b = read('.github/workflows/rapor-bayrak.yml');
  test('tetikler: kalp zinciri (repository_dispatch) + cron yedeği + elle', () => {
    assert.match(b, /types: \[rapor-kalp-bayrak\]/);
    assert.match(b, /cron: '\*\/5 \* \* \* \*'/, 'cron yedeği');
    assert.match(b, /workflow_dispatch/);
  });
  test('bayrak KALPİ tetikler (farklı-workflow bacağı — kanıtlı yol)', () => {
    assert.match(b, /workflows\/rapor-kalp\.yml\/dispatches/);
    assert.match(b, /actions: write/);
  });
  test('0023 sertleştirmesi: set +euo, TEK adım, daima exit 0, ifade(if:) YOK', () => {
    // 16:45 kazası: adım 2 sn'de exit 1 — GitHub ifade değerlendiricisi/boru
    // zinciri kırılgan çıktı. Yeni sözleşme: karar düz bash, curl→dosya,
    // HTTP kodu loglanır, her yol exit 0 (kör nokta bırakılmaz).
    assert.match(b, /set \+euo pipefail/);
    assert.match(b, /exit 0/);
    assert.match(b, /-w '%\{http_code\}'/, 'HTTP kodu görünür');
    assert.match(b, /mktemp/, 'curl çıktısı dosyaya');
    assert.ok(!/if: steps\./.test(b), 'adım düzeyinde GitHub ifadesi YOK');
    const adim = (b.match(/- name:/g) || []).length;
    assert.equal(adim, 1, 'tek adım: karar + tetik aynı betikte');
  });
  test('mükerrer nabız üretmez: kalp 4 dk içinde koştuysa susar (bash karar)', () => {
    assert.match(b, /AGE.*-ge 4|-ge 4/, '4 dk eşiği');
    assert.match(b, /bayrak susuyor/, 'susma yolu loglanır');
    assert.match(b, /AGE=999/, 'yaş çözülemezse GÜVENLİ taraf: dik (zincir kopmasın)');
  });
  test('uçuz iş: checkout YOK, timeout 2 dk', () => {
    assert.ok(!/actions\/checkout/.test(b), 'bayrak depo indirmez');
    assert.match(b, /timeout-minutes: 2/);
  });
});
