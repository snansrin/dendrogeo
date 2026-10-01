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
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
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

/* 4) PGRST201 — ÇOKLU İLİŞKİ TUZAĞI (canlıda 2026-09-24)
 *
 * 0003_audit_and_agg.sql measurements'a `reviewed_by uuid references profiles(id)`
 * ekledi. O andan itibaren measurements→profiles arasında İKİ FK var (owner +
 * reviewed_by) ve PostgREST çıplak `profiles(full_name)` gömüsünü çözemiyor:
 *
 *   PGRST201 "Could not embed because more than one relationship was found
 *   for 'measurements' and 'profiles'"
 *   hint: 'profiles!measurements_owner_fkey', 'profiles!measurements_reviewed_by_fkey'
 *
 * Sonuç: data=null. Eski kod `mRes.data||[]` ile bunu boş liste sandı ve
 * yönetim tablosuna "Kayıt yok." bastı — kullanıcı verisinin silindiğini
 * düşündü. İki ders kilitleniyor: (a) gömü FK adıyla belirtilmeli,
 * (b) sorgu hatası asla sessizce "veri yok"a dönüşmemeli. */
describe('PGRST201 çoklu ilişki: measurements→profiles gömüsü FK adıyla', () => {
  const adm = readFileSync(join(ROOT, 'src/services/admin.js'), 'utf8');
  const tree = readFileSync(join(ROOT, 'src/services/admin-tree.js'), 'utf8');
  const dreq = readFileSync(join(ROOT, 'src/services/data-requests.js'), 'utf8');

  test('⭐ admin.js ölçüm sorgusu profiles!measurements_owner_fkey kullanıyor', () => {
    assert.match(adm, /measurements"\)\.select\("\*,profiles!measurements_owner_fkey\(full_name\)"\)/);
  });

  test('⭐ admin-tree.js aynı FK adını kullanıyor', () => {
    assert.match(tree, /profiles!measurements_owner_fkey\(full_name\)/);
  });

  test('measurements üzerinde ÇIPLAK profiles( gömüsü kalmadı', () => {
    const bad = [adm, tree].filter((f) => /measurements"[^;]{0,120}\.select\("[^"]*(?<!_fkey)profiles\(/.test(f));
    assert.equal(bad.length, 0, 'çıplak profiles( gömüsü PGRST201 üretir');
  });

  test('data_requests tek FK olduğu için çıplak gömü güvenli (belgeleme)', () => {
    /* data_requests.user_id → profiles: tek ilişki, PGRST201 riski yok. */
    assert.match(dreq, /data_requests"\)\.select\("\*,profiles\(full_name\)"\)/);
  });

  test('⭐ sorgu hatası sessizce "Kayıt yok."a dönüşmüyor', () => {
    assert.match(adm, /if\(mRes\.error\)\{/, 'hata dalı olmalı');
    assert.match(adm, /veri silinmedi/, 'kullanıcıya güvence');
    assert.match(tree, /Ölçümler okunamadı/, 'ağaçta hata kutusu');
    assert.match(tree, /mode:"join"/, 'gömüsüz yedek sorgu');
  });
});

/* 5) SUPABASE-JS ZİNCİR SIRASI (canlıda 2026-09-24)
 *
 * sb.from(t) bir PostgrestQueryBuilder döndürür: yalnız select/insert/update/
 * delete/upsert vardır. order/limit/eq/range/single FİLTRE kurucusundadır ve
 * ancak select()'ten (veya insert/update'den) SONRA çağrılabilir.
 *
 * admin-tree.js ilk sürümünde `sb.from("measurements").order(...)` yazılmıştı
 * → TypeError: order is not a function → await reddedildi → yönetim ağacı
 * sonsuza dek "⏳ Ölçümler yükleniyor…"da asılı kaldı. Bu canary desenin
 * repoya bir daha girmesini engeller (tüm src/** taranır). */
describe('supabase-js zincir sırası: from() sonrası doğrudan filtre metodu YOK', () => {
  const dosyalar = [];
  const yuru = (d) => { for (const a of readdirSync(d)) { const t = join(d, a); if (statSync(t).isDirectory()) yuru(t); else if (a.endsWith('.js')) dosyalar.push(t); } };
  yuru(join(ROOT, 'src'));

  const KOTU = /\.from\(\s*("[^"]*"|'[^']*')\s*\)\s*\.(order|limit|range|eq|neq|gt|gte|lt|lte|is|in|ilike|single|maybeSingle)\s*\(/;

  test('⭐ hiçbir modül from() üzerine doğrudan order/limit/eq zincirlemiyor', () => {
    const bozuk = dosyalar
      .map((f) => [f, readFileSync(f, 'utf8')])
      .filter(([, src]) => KOTU.test(src))
      .map(([f, src]) => f.split('/src/')[1] + ' → ' + (src.match(KOTU) || [''])[0]);
    assert.deepEqual(bozuk, [], 'geçersiz zincir (TypeError → ekran asılı kalır): ' + bozuk.join(' | '));
  });

  test('admin-tree sorgusu select → order → limit sırasını kullanıyor', () => {
    const tree = readFileSync(join(ROOT, 'src/services/admin-tree.js'), 'utf8');
    assert.match(tree, /\.select\(DG_TREE_SEL_FULL,\{count:"exact"\}\)\s*\.order\("created_at",\{ascending:false\}\)\s*\.limit\(1000\)/);
  });
});

describe('kaldığın yerden devam (sekme + kaydırma) — 2026-09-27', () => {
  const read = (p) => readFileSync(join(ROOT, p), 'utf8');
  const shell = read('src/ui/shell.js');
  test('go() sekme adını kalıcı olarak saklar', () => {
    assert.match(shell, /dgSaveView\(v\)/, 'go() her sekme değişiminde yazar');
    assert.match(shell, /localStorage\.setItem\("dg_last_view"/, 'anahtar dg_last_view');
  });
  test('startShell yenilemede son sekmeyi geri açar', () => {
    assert.match(shell, /const lv=dgLastView\(\);/, 'son sekme okunur');
    assert.match(shell, /if\(lv&&lv!=="dash"&&\$\("v-"\+lv\)\)/, 'geçersiz sekme adında patlamaz');
  });
  test('kaydırma konumu sekme bazında saklanır ve geri gelir', () => {
    assert.match(shell, /localStorage\.setItem\("dg_scroll_"\+DG_CUR_VIEW/, 'kaydırma yazma');
    assert.match(shell, /localStorage\.getItem\("dg_scroll_"\+v\)/, 'kaydırma okuma');
    assert.match(shell, /passive:true/, 'scroll dinleyicisi passive olmalı');
  });
  test('storage patlarsa (gizli mod) uygulama düşmez', () => {
    const writes = (shell.match(/try\{\s*(return\s+)?localStorage/g) || []).length;
    assert.ok(writes >= 4, 'tüm storage erişimleri try/catch içinde, got ' + writes);
  });
});

describe('uzaktan proje + canlı kaydet butonu — 2026-09-27', () => {
  const read2 = (p) => readFileSync(join(ROOT, p), 'utf8');
  test('⭐ uzaktaki parka PROJE açılabilir: ada göre arama var ve GPS şartı yok', () => {
    const pr = read2('src/services/park-registry.js');
    assert.match(pr, /async function dgScanSearchByName/, 'ada göre arama fonksiyonu');
    assert.match(pr, /window\.dgScanSearchByName=/, 'scan kartından çağrılabilir');
    assert.match(pr, /id="scanRemote"/, 'arama kutusu scan kartında');
    assert.match(pr, /Uzak parkta .*proje açabilirsin/, 'kural kullanıcıya yazılı söylenir');
    const i = pr.indexOf('async function dgScanCreateProject');
    const govde = pr.slice(i, pr.indexOf('async function dgScanLinkTarget', i));
    assert.doesNotMatch(govde, /dgVerifyAtPark/, 'proje açılışında konum bloğu YOK');
  });
  test('ölçüm kapısı DURUYOR: saveMeas hâlâ konum doğruluyor', () => {
    const m = read2('src/services/measure.js');
    assert.match(m, /dgVerifyAtPark\(pk\.data,"measure"\)/, 'uzak parkta ölçüm hâlâ engelli');
  });
  test('⭐ Hesapla ve Kaydet CANLI buton (aynı desen: disabled + ⏳ + finally)', () => {
    const m = read2('src/services/measure.js');
    assert.match(m, /function dgSaveBusy\(on\)/, 'canlı yardımcı');
    assert.match(m, /"⏳ Hesaplanıyor ve kaydediliyor…"/, '⏳ metni');
    assert.match(m, /finally\{dgSaveBusy\(false\);\}/, 'her çıkış yolunda geri gelir');
    assert.match(m, /async function dgSaveMeasInner/, 'iç gövde ayrı, sarmalayıcı dışta');
  });
  test('tam genişlik CTA' + '\u2019' + 'lar tek ailede (dg-png-btn)', () => {
    const sh = read2('partials/shell.html');
    assert.match(sh, /id="saveBtn"[^>]*class="dg-png-btn primary"|class="dg-png-btn primary" id="saveBtn"/, 'kaydet butonu ailede');
    assert.match(sh, /class="dg-png-btn primary" style="margin-top:14px" onclick="arriveWp\(\)"/, 'vardım butonu ailede');
    assert.doesNotMatch(sh, /class="btn" style="width:100%/, 'eski dağınık desen kalmamalı');
  });
});

describe('kalite denetimi 2026-09-27 kilidi (P1/P3/P7/P9)', () => {
  const rd = (p) => readFileSync(join(ROOT, p), 'utf8');
  test('P1 kontrast tokenları AA eşiğinde', () => {
    const c = rd('css/style.css');
    assert.match(c, /--mut:#5f6d65/, 'soluk metin tokeni koyulastirilmali');
    assert.match(c, /--amber-ink:#9a4a08/, 'amber metin tokeni');
    assert.match(c, /\.badge\.admin\{background:var\(--amber-tint\);color:var\(--amber-ink\)\}/);
  });
  /* KASKAD KİLİDİ (2026-10-01 denetim O2/O3): ui-standard.css HER sayfada
   * en SON yüklenir → :root tokenları style.css'i ezer. Eskiden burada
   * --mut:#68766e (4.41:1) duruyordu ve 27.09 WCAG düzeltmesini (#5f6d65,
   * 5.03:1) sessizce geri alıyordu; P1 testi yalnız style.css metnine
   * baktığı için yakalayamıyordu. Artık iki dosya da kilitli. */
  test('⭐ ui-standard.css tokenları style.css WCAG değerleriyle aynı (kaskad kilidi)', () => {
    const u = rd('css/ui-standard.css');
    assert.match(u, /--mut:#5f6d65/, 'ui-standard --mut, style.css ile ayni olmali (son yuklenen kazanir)');
    assert.match(u, /--amber-ink:#9a4a08/, 'amber metin tokeni ui-standard :rootunda da tanimli olmali');
    assert.ok(!/--mut:#68766e/.test(u), 'eski dusuk kontrast token deklarasyonu geri gelmemeli');
  });
  test('⭐ küçük amber metinler --amber-ink kullanır (3.03:1 → 5.78:1)', () => {
    const l = rd('css/landing.css');
    const u = rd('css/ui-standard.css');
    assert.match(l, /\.hero \.kick\{[^}]*color:var\(--amber-ink\)/, 'hero kicker');
    assert.match(l, /\.step \.sub\{[^}]*color:var\(--amber-ink\)/, 'step altligi');
    assert.match(u, /\.dg-kicker\{[^}]*color:var\(--amber-ink\)/, 'alt sayfa kicker');
    assert.match(u, /\.dg-page \.tag\{[^}]*color:var\(--amber-ink\)/, 'alt sayfa tag');
  });
  test('P3 skip-link + focus halkasi + label.lbl blok (kayma yok)', () => {
    const h = rd('partials/head.html');
    assert.match(h, /class="dg-skip" href="#main"/, 'skip link');
    const c = rd('css/style.css');
    assert.match(c, /label\.lbl\{display:block\}/, 'label div ile ayni kutu');
    assert.match(c, /:focus-visible\{outline:2px solid var\(--green\)/, 'odak halkasi');
    assert.match(c, /\.dg-skip\{position:absolute;left:-9999px/, 'skip link akista yer kaplamaz');
    const sh = rd('partials/shell.html');
    assert.ok((sh.match(/<label class="lbl" for="/g) || []).length >= 10, 'label for donusumu');
  });
  test('P7 geom backfill: fonksiyon + dugme + CSP origin', () => {
    const r = rd('src/services/park-registry.js');
    assert.match(r, /async function dgBackfillGeom/, 'backfill fonksiyonu');
    assert.match(r, /yetki|role!==\"admin\"/, 'yonetici kapisi');
    assert.match(r, /api\.openstreetmap\.org\/api\/0\.6/, 'OSM ana API');
    assert.match(rd('partials/head.html'), /https:\/\/api\.openstreetmap\.org/, 'CSP beyaz listesi');
  });
  test('P9 EN methods sayfasi + sitemap + hreflang', () => {
    assert.ok(existsSync(join(ROOT, 'en/methods/index.html')), 'sayfa var');
    const en = rd('en/methods/index.html');
    assert.match(en, /hreflang="tr"/); assert.match(en, /Chave et al\. \(2014\)/);
    assert.match(rd('sitemap.xml'), /\/en\/methods\//);
    assert.match(rd('yontem/index.html'), /hreflang="en"/);
  });
});

describe("link bütünlüğü: hiçbir sayfa 404’e link vermez (2026-09-27 kazası)", () => {
  /* KAZA: /en/methods/ iki seviye derin ama linkleri ../ ile yazılmıştı →
   * ../yontem/ = /en/yontem/ = 404 (GitHub Pages). Bu test TÜM sayfaların
   * göreli ve kök linklerini dosya sisteminde çözer; ağ gerektirmez. */
  const pages = [];
  (function walk(d) {
    for (const e of readdirSync(join(ROOT, d), { withFileTypes: true })) {
      if (e.isDirectory()) {
        if (['.git', 'node_modules', 'vendor', 'out', '.github', 'scripts', 'src', 'css', 'partials', 'test', 'docs', 'supabase'].includes(e.name)) continue;
        walk(join(d, e.name));
      } else if (e.name === 'index.html') pages.push(join(d, e.name));
    }
  })('');
  test('en az 13 sayfa taranır', () => assert.ok(pages.length >= 13, pages.join(',')));
  for (const f of pages) {
    test(f + ' → tüm göreli/kök linkler dosyada karşılık bulur', () => {
      const t = readFileSync(join(ROOT, f), 'utf8');
      const bad = [];
      for (const m of t.matchAll(/(?:href|src)="([^"#]+)"/g)) {
        let rel = m[1];
        if (/^(https?:|mailto:|tel:|data:|file:|#)/.test(rel)) continue;
        rel = rel.split('?')[0];
        const target = rel.startsWith('/')
          ? join(ROOT, rel)
          : join(dirname(join(ROOT, f)), rel);
        if (!existsSync(target) && !existsSync(target + '.html') && !existsSync(join(target, 'index.html'))) bad.push(rel);
      }
      assert.deepEqual(bad, [], 'kırık link(ler): ' + bad.join(', '));
    });
  }
});
