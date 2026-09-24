/* critical-fixes.test.mjs — CANLIDA KANITLANMIŞ İKİ KRİTİK HATANIN BEKÇİSİ
 *
 * Bu iki hata da Node tarafında YEŞİL testlerle yaşayabiliyordu; canlı
 * ortamda (tarayıcı + gerçek API) doğrulanıp düzeltildi (2026-09-24):
 *
 * 1) STAC /search POST + application/json → tarayıcı preflight OPTIONS
 *    gönderir → Planetary Computer OPTIONS'a 405 döner → LULC analizi
 *    tarayıcıda daha ilk adımda ölür. Çözüm: GET + querystring (simple
 *    request, preflight yok). Bu test POST deseninin GERİ GELMEMESİNİ kilitler.
 *
 * 2) trackVisit → sb.from("site_visits").insert({}) → supabase-js varsayılanı
 *    "Prefer: return=representation" → anon SELECT hakkı yok → 401/42501 →
 *    sayaç sessizce ölür. Çözüm: raw fetch + "Prefer: return=minimal".
 *
 * 3) index.html QGIS rehberindeki kopya "Fotoğraf balonu" maddesi kaldırıldı.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
/* Faz 5: STAC katmanı lc-stac.js'e taşındı — canary yeni modülü okuyor. */
const lc = readFileSync(join(ROOT, 'src/services/lc-stac.js'), 'utf8');
/* Faz 6: ziyaret sayacı visit-stats.js'e taşındı */
const adm = readFileSync(join(ROOT, 'src/services/visit-stats.js'), 'utf8');
const idx = readFileSync(join(ROOT, 'index.html'), 'utf8');

describe('STAC araması GET olmalı (CORS preflight tuzağı)', () => {
  test('dgLcFindTiles POST + JSON body kullanmıyor', () => {
    const bas = lc.indexOf('function dgLcFindTiles');
    assert.ok(bas > -1, 'dgLcFindTiles bulunamadı');
    const govde = lc.slice(bas, lc.indexOf('\nasync function dgLcGetSas', bas));
    assert.ok(!/method\s*:\s*["']POST["']/.test(govde), 'STAC araması POST’a geri dönmüş — tarayıcıda preflight 405 ile ölür');
    assert.ok(!/body\s*:\s*JSON\.stringify/.test(govde), 'STAC aramasında JSON body var — preflight tetikler');
    assert.ok(govde.includes('URLSearchParams'), 'STAC araması GET querystring ile yapılmalı');
    assert.ok(govde.includes('"/search?"') || govde.includes("'/search?'") || /\/search\?/.test(govde), 'arama URL’i /search?… olmalı');
  });
});

describe('ziyaretçi sayacı RLS-safe olmalı', () => {
  test('trackVisit return=minimal ile raw fetch kullanıyor', () => {
    const bas = adm.indexOf('async function trackVisit');
    assert.ok(bas > -1, 'trackVisit bulunamadı');
    const govde = adm.slice(bas, adm.indexOf('\n}', bas + 40) + 2);
    assert.ok(!/\.insert\(\{\}\)/.test(govde), 'insert({}) geri gelmiş — return=representation RLS 401 ile sayacı öldürür');
    assert.ok(govde.includes('return=minimal'), 'Prefer: return=minimal başlığı zorunlu');
    assert.ok(govde.includes('site_visits'), 'hedef tablo site_visits olmalı');
  });
});

describe('QGIS rehberi içerik temizliği', () => {
  test('kopya "Fotoğraf balonu" maddesi yok', () => {
    assert.ok(!idx.includes('<b>Fotoğraf balonu:</b>'), 'kopya madde geri gelmiş');
    const n = (idx.match(/dendro_foto/g) || []).length;
    assert.ok(n <= 2, 'dendro_foto örneği beklenenden çok tekrar ediyor: ' + n);
  });
});
