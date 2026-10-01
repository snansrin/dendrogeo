/* landing-claims.test.mjs — 0035 BEKÇİLERİ (dış denetim raporu · plan madde D)
 *
 * Neden: landing'in bilimsel iddiaları ile kod gerçeği İKİ KEZ ayrıştı
 * (45/17 tür sayısı; "DBH = Çevre ÷ π" — 0031 kırmızı çizgisi). Bu dosya
 * vitrindeki her sayısal/hukuki iddiayı KAYNAĞINDAN yeniden üretir:
 *   · tür sayıları species.js'ten hesaplanır → landing + methods.md ile karşılaştırılır
 *   · hero çipleri allometrik motorla yeniden üretilir + QA h/D bandında mı bakılır
 *   · DBH üst sınırı üç yerde (form · landing · rapor QA) TEK sayı olmalı
 *   · çevre→çap dönüşümü beyanı hiçbir yayın sayfasında olamaz (0031)
 *   · WCAG token tek kaynağı, amber metin yasağı, GROUP_COLOR_INK
 *   · th scope / label for / klavye / aria-live / hreflang / sitemap / i18n
 * Kırmızı çizgi: motor, katsayılar, MC_CFG, şema, rapor çıktıları — bu test
 * onları DEĞİŞTİRMEZ, yalnız vitrin↔kod tutarlılığını kilitler. */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { QA_LIMITS } from '../scripts/lib/mc.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');
const landing = rd('partials/landing.html');
const shell = rd('partials/shell.html');
const head = rd('partials/head.html');
const index = rd('index.html');

/* Alt sayfalar (rapor/ hariç — yayımlanmış çıktılar dondurulmuştur) */
const SUBS = readdirSync(ROOT).filter((d) =>
  !d.startsWith('.') && d !== 'vendor' && d !== 'node_modules' && d !== 'rapor' && d !== 'partials' &&
  existsSync(join(ROOT, d, 'index.html')));

describe('P0 · bilimsel iddialar kaynağıyla birebir', () => {
  test('⭐ çevre→çap dönüşümü beyanı hiçbir yayın sayfasında YOK (0031 kırmızı çizgisi)', () => {
    const yasak = [/Çevre\s*÷\s*π/i, /çevre\s*\/\s*π/i, /girth\s*\/\s*π/i];
    const sayfalar = ['partials/landing.html', 'partials/shell.html', 'index.html',
      ...SUBS.map((d) => d + '/index.html')];
    for (const f of sayfalar) {
      const t = rd(f);
      for (const y of yasak) assert.ok(!y.test(t), f + ' içinde dönüşüm beyanı: ' + y);
    }
    /* Landing DBH'yi DOĞRU tanımlıyor */
    assert.match(landing, /DBH = göğüs çapı \(cm\)/, 'DBH tanımı göğüs çapı olmalı');
    assert.match(landing, /çevre→çap dönüşümü UYGULANMAZ/, 'dönüşüm uygulanmadığı açıkça söylenmeli');
  });

  test('⭐ tür tablosu sayıları species.js\'ten yeniden üretiliyor (landing + methods)', () => {
    const ctx = {};
    vm.createContext(ctx);
    vm.runInContext(rd('src/config/species.js') + ';this.S=SPECIES_DATA;', ctx);
    let total = 0, rho = 0;
    for (const arr of Object.values(ctx.S)) { total += arr.length; rho += arr.filter((s) => s.rho != null).length; }
    const def = total - rho;
    const re = new RegExp(`tablosunda ${total} seçim kaydı bulunur; ${rho} kaydın doğrudan ρ değeri vardır, ${def} kayıt grup varsayılanına düşer`);
    assert.match(landing, re, `landing güncel olmalı: ${total}/${rho}/${def}`);
    assert.match(rd('docs/methods.md'), new RegExp(`28/${total}`), 'methods.md aynı sayıyı söylemeli');
  });

  test('⭐ hero çipleri motorla birebir üretiliyor + QA h/D bandında', () => {
    const D = +landing.match(/DBH (\d+(?:[.,]\d+)?) cm/)[1].replace(',', '.');
    const H = +landing.match(/H (\d+(?:[.,]\d+)?) m/)[1].replace(',', '.');
    const C = +landing.match(/C (\d+(?:[.,]\d+)?) kg/)[1].replace(',', '.');
    /* allometry.js calc() ile aynı denklem; ρ = İBRELİ grup varsayılanı (446) */
    const rhoCtx = {};
    vm.createContext(rhoCtx);
    vm.runInContext(rd('src/config/species.js') + ';this.G=GROUP_DEFAULT_RHO;', rhoCtx);
    const r = rhoCtx.G['\u0130BREL\u0130'] / 1000;
    const agb = 0.0673 * Math.pow(r * D * D * H, 0.976);
    const beklenen = agb * 1.26 * 0.47;
    assert.ok(Math.abs(beklenen - C) < 0.06, `çip C=${C} kg ama motor ${beklenen.toFixed(1)} kg üretiyor`);
    const hd = 100 * H / D;
    assert.ok(hd >= QA_LIMITS.HD_MIN && hd <= QA_LIMITS.HD_MAX,
      `vitrin örneği QA tipik bandında olmalı (h/D=${hd.toFixed(1)}, bant ${QA_LIMITS.HD_MIN}-${QA_LIMITS.HD_MAX})`);
  });

  test('⭐ DBH üst sınırı TEK standart: form = landing = rapor QA (400 cm)', () => {
    const measure = rd('src/services/measure.js');
    assert.match(measure, /if\(d>400\|\|h>100\)/, 'form eşiği 400');
    assert.match(landing, /DBH ≤ 400 cm, boy ≤ 100 m/, 'landing QA kartı 400');
    assert.equal(QA_LIMITS.DBH_MAX_CM, 400, 'rapor QA 400');
    assert.equal(QA_LIMITS.H_MAX_M, 100, 'boy üst sınırı her yerde 100');
  });
});

describe('P0 · künye/JSON-LD tutarlılığı', () => {
  test('sameAs\'te çelişkili lisanslı eski DOI yok', () => {
    assert.ok(!head.includes('10.5281/zenodo.22646300'), 'v1.0.0 DOI (cc-by-4.0) sameAs\'ten çıkarılmalı');
  });
  test('copyrightHolder iki ayrı Person', () => {
    const ld = JSON.parse(head.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
    const app = ld['@graph'].find((n) => n['@type'] === 'WebApplication');
    assert.ok(Array.isArray(app.copyrightHolder) && app.copyrightHolder.length === 2, 'iki Person');
    assert.equal(app.copyrightHolder[0].name, 'Nagihan ŞİRİN');
    assert.equal(app.softwareVersion, JSON.parse(rd('package.json')).version, 'softwareVersion tam SemVer');
  });
  test('meta keywords yok (Google\'da etkisiz, kaldırıldı)', () => {
    assert.ok(!/<meta name="keywords"/.test(head));
  });
});

describe('P1 · WCAG ve token disiplini', () => {
  const cssAll = ['style.css', 'landing.css', 'ui-standard.css', 'park-panel.css'].map((f) => rd('css/' + f));
  test('metin rengi olarak --amber kullanımı YOK (dolgu/kenarlık serbest)', () => {
    for (const c of cssAll) {
      for (const m of c.matchAll(/(^|[{;])\s*color:var\(--amber\)/gm)) {
        assert.fail('color:var(--amber) metinde kullanılamaz (3.03:1): ' + m[0]);
      }
    }
  });
  test('#68766e ne css/ ne src/ içinde kaldı', () => {
    for (const c of cssAll) assert.ok(!c.includes('68766e'));
    for (const f of ['src/services/dash.js', 'src/services/map.js']) assert.ok(!rd(f).includes('68766e'), f);
  });
  test('tek :focus-visible kuralı (style.css)', () => {
    const n = (rd('css/style.css').match(/^:focus-visible\{/gm) || []).length;
    assert.equal(n, 1, 'çelişen çift kural geri gelmemeli');
  });
});

describe('P1 · erişilebilirlik sözleşmesi', () => {
  test('⭐ sol menü öğeleri klavyeyle etkinleştirilebilir', () => {
    const items = shell.match(/<div class="item[^"]*"[^>]*onclick="go\(/g) || [];
    assert.ok(items.length >= 9, 'menü öğeleri bulunmalı');
    for (const it of items) {
      assert.match(it, /role="button"/, 'role eksik: ' + it);
      assert.match(it, /tabindex="0"/, 'tabindex eksik: ' + it);
      assert.match(it, /onkeydown="dgKeyActivate/, 'keydown eksik: ' + it);
    }
    assert.match(rd('src/ui/state.js'), /function dgKeyActivate/, 'dgKeyActivate tanımlı');
  });
  test('⭐ form alanlarının erişilebilir adı var (label for / aria-label)', () => {
    const birlesim = landing + shell;
    for (const id of ['liEmail', 'liPass', 'rgName', 'rgOrg', 'rgEmail', 'rgPass', 'rsEmail', 'mPoint', 'mPhoto', 'nCsv', 'adminMeasSearch', 'userSearch', 'rcPass', 'rcPass2']) {
      const ok = birlesim.includes(`for="${id}"`) || new RegExp(`id="${id}"[^>]*aria-label=`).test(birlesim);
      assert.ok(ok, id + ' için label/aria-label yok');
    }
  });
  test('statik <th> elemanlarında scope var (partials + alt sayfalar)', () => {
    const files = ['partials/landing.html', 'partials/shell.html', ...SUBS.map((d) => d + '/index.html')];
    for (const f of files) {
      const t = rd(f);
      const bos = (t.match(/<th(?![a-z-])(?![^>]*scope)[^>]*>/g) || []).filter((x) => !x.startsWith('<thead'));
      assert.deepEqual(bos, [], f + ' scope\'suz th: ' + bos.join(','));
    }
  });
  test('toast canlı bölge: toast.js aria-live atıyor (build çapası statik yazıma kapalı)', () => {
    assert.match(rd('src/ui/toast.js'), /setAttribute\("aria-live","polite"\)/);
    assert.match(rd('src/ui/toast.js'), /setAttribute\("role","status"\)/);
  });
  test('hamburger disclosure: aria-expanded + aria-controls + Esc', () => {
    assert.match(landing, /id="navToggle"[^>]*aria-expanded="false"[^>]*aria-controls="navLinks"/);
    assert.match(rd('src/ui/landing.js'), /function dgNavToggle/);
    assert.match(rd('src/ui/landing.js'), /Escape/);
  });
});

describe('P1 · SEO/çok dillilik', () => {
  test('hreflang simetrisi: index tr+en+x-default; en/ de öyle', () => {
    for (const t of [head, rd('en/index.html')]) {
      assert.match(t, /hreflang="tr"/); assert.match(t, /hreflang="en"/); assert.match(t, /hreflang="x-default"/);
    }
  });
  test('sitemap /rapor/ galerisini ve geçerli DGR yayınını içeriyor', () => {
    const sm = rd('sitemap.xml');
    assert.match(sm, /<loc>https:\/\/dendrogeo\.org\/rapor\/<\/loc>/);
    assert.match(sm, /rapor\/DGR-\d{4}-\d{4}\//);
  });
  test('dil düğmesi landing topnav VE uygulama üst barında (EN↔TR)', () => {
    assert.match(landing, /class="btn sm ghost dg-lang-toggle" onclick="dgToggleLang\(\)"/);
    assert.match(shell, /class="btn sm ghost dg-lang-toggle" onclick="dgToggleLang\(\)"/);
  });
});

describe('P2 · temizlik kalıcı', () => {
  test('hero statband kaldırıldı, §04 İstatistik duruyor (kullanıcı kararı)', () => {
    assert.ok(!landing.includes('statband'), 'statband geri gelmemeli');
    assert.ok(!rd('src/ui/landing.js').includes('stRec'), 'stRec atamaları geri gelmemeli');
    assert.match(landing, /id="statRec"/, '§04 istatistik kartı durmalı');
  });
  test('ölü animasyon sınıfları landing.css\'e geri dönmedi', () => {
    const c = rd('css/landing.css');
    for (const s of ['.tape{', '.bob{', '.bird{', '.butterfly{', '.co2{', '.soildot{', '.sunrays{', '.leaf{'])
      assert.ok(!c.includes(s), s + ' geri gelmiş');
  });
  test('footer politika linkleri gerçek sayfalara gidiyor (sahte toast linki yok)', () => {
    assert.ok(!/onclick="toast\('KVKK/.test(landing), 'KVKK toast linki geri gelmemeli');
    assert.ok(!/onclick="toast\('Veri Doğruluk/.test(landing), 'Veri Doğruluk toast linki geri gelmemeli');
    assert.match(landing, /<a href="\/aydinlatma\/"[^>]*>KVKK Aydınlatma Metni<\/a>/);
  });
  test('404.html var ve standart tasarım sistemine bağlı', () => {
    const t = rd('404.html');
    assert.match(t, /css\/style\.css/); assert.match(t, /css\/ui-standard\.css/);
    assert.match(t, /class="dg-page"/);
  });
  test('sw.js CORE_ASSETS: apple-touch-icon + i18n precache\'de', () => {
    const sw = rd('sw.js');
    assert.match(sw, /'\/apple-touch-icon\.png'/);
    assert.match(sw, /'\/src\/config\/i18n\.js'/);
  });
});

describe('i18n katmanı sözleşmesi (0035)', () => {
  const i18n = rd('src/config/i18n.js');
  test('sözlük kapsamlı ve çekirdek dizeler çevrili', () => {
    const n = (i18n.match(/":"/g) || []).length;
    assert.ok(n >= 150, 'EN sözlüğü en az 150 dize içermeli, bulunan: ' + n);
    for (const s of ['"Sistem":"System"', '"Çıkış":"Log out"', '"📊 Panel":"📊 Dashboard"',
      '"Giriş Yap":"Log in"', '"Hesap Oluştur":"Create account"', '"Kayıtlarım":"My Records"'])
      assert.ok(i18n.includes(s), 'eksik çeviri: ' + s);
  });
  test('kalıcılık + html lang + ters harita + MutationObserver var', () => {
    assert.match(i18n, /localStorage\.getItem\("dg_lang"\)/);
    assert.match(i18n, /documentElement\.lang=DG_LANG/);
    assert.match(i18n, /DG_I18N_TR\[DG_I18N_EN\[k\]\]=k/);
    assert.match(i18n, /MutationObserver/);
    assert.match(i18n, /dg:lang/, 'dil olayı yayınlanıyor (modüller yeniden render için)');
  });
  test('i18n.js kayıt zinciri: index.html tag + defer + CORE_ASSETS', () => {
    assert.match(index, /<script src="src\/config\/i18n\.js\?v=[0-9a-f]{8}" defer>/);
    assert.match(rd('sw.js'), /'\/src\/config\/i18n\.js'/);
  });
  test('KVKK rıza metni bilinçli olarak çevrilmiyor (hukuki metin TR kalır)', () => {
    assert.ok(!i18n.includes('onaylıyorum. Rızamı dilediğim zaman'), 'rıza metni sözlüğe EKLENMEMELİ');
  });
});
