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
const speciesRuntime = () => rd('src/config/wood-density-lock.js') + '\n' + rd('src/config/species.js');

/* Alt sayfalar (rapor/ hariç — yayımlanmış çıktılar dondurulmuştur) */
const SUBS = readdirSync(ROOT).filter((d) =>
  !d.startsWith('.') && d !== 'vendor' && d !== 'node_modules' && d !== 'rapor' && d !== 'partials' &&
  existsSync(join(ROOT, d, 'index.html')));

describe('P0 · bilimsel iddialar kaynağıyla birebir', () => {
  test('⭐ FINAL ölçüm protokolü: çevre ölçülür, DBH = çevre/π türetilir', () => {
    const lock = rd('src/config/measurement-protocol-lock.js');
    assert.match(lock, /DG-MEASURE-LOCK-2026-10-06-FINAL/);
    assert.match(lock, /diameter_cm=circumference_cm\/pi/);
    assert.match(lock, /raw_field:"measurements\.girth_cm"/);
    assert.match(lock, /derived_field:"measurements\.dbh_cm"/);
    assert.match(landing, /DBH = göğüs çevresi ÷ π/);
    assert.match(shell, /Göğüs çevresi/);
    assert.match(rd('docs/methods.md'), /D = C \/ π/);
    const aktif=['partials/landing.html','partials/shell.html','src/services/measure.js',
      'scripts/make-report.mjs','scripts/import-measurements.mjs','docs/methods.md'];
    const yasak=[/çevre→çap[^\n]{0,80}(?:YAPILMAZ|uygulanmaz)/i,/sahada doğrudan çap/i,/doğrudan çap olarak ölç/i];
    for(const file of aktif)for(const re of yasak)assert.ok(!re.test(rd(file)),file+' eski yanlış ölçüm iddiası: '+re);
  });

  test('⭐ tür/grup adları EN sözlüğünde tam kapsanıyor (0035b)', () => {
    const sctx = {};
    vm.createContext(sctx);
    vm.runInContext(speciesRuntime() + ';this.S=SPECIES_DATA;', sctx);
    /* i18n.js açılışta DOM'a dokunur (init + MutationObserver) → test stub'ı */
    const ictx = {
      window: { dispatchEvent: () => {} },
      document: { readyState: 'complete', querySelectorAll: () => [], addEventListener: () => {}, documentElement: {}, title: 'x', getElementById: () => null, body: {} },
      CustomEvent: function () {},
    };
    vm.createContext(ictx);
    vm.runInContext(rd('src/config/i18n.js') + ';this.E=DG_I18N_EN;this.T=DG_I18N_TR;', ictx);
    const eksik = [];
    for (const arr of Object.values(sctx.S)) for (const s of arr) if (!(s.tr in ictx.E)) eksik.push(s.tr);
    assert.deepEqual(eksik, [], 'EN sözlüğünde eksik tür: ' + eksik.join(', '));
    /* EN→TR geri dönüş tek anlamlı olmalı (çakışan değer = yanlış restorasyon) */
    const rev = {}; const cak = [];
    for (const [k, v] of Object.entries(ictx.E)) { if (rev[v] && rev[v] !== k) cak.push(v); rev[v] = k; }
    assert.deepEqual(cak, [], 'EN→TR çakışması (değerler benzersiz olmalı): ' + cak.join(', '));
  });

  test('⭐ tür tablosu sayıları species.js\'ten yeniden üretiliyor (landing + methods)', () => {
    const ctx = {};
    vm.createContext(ctx);
    vm.runInContext(speciesRuntime() + ';this.S=SPECIES_DATA;', ctx);
    let total = 0, rho = 0;
    for (const arr of Object.values(ctx.S)) { total += arr.length; rho += arr.filter((s) => s.rho != null).length; }
    const def = total - rho;
    const re = new RegExp(`Ölçüm kataloğunda ${total} tür bulunur; ${rho} tür kilitli özel ρ kullanır, ${def} tür yalnız kendi grup genelini kullanır`);
    assert.match(landing, re, `landing güncel olmalı: ${total}/${rho}/${def}`);
    assert.match(rd('docs/methods.md'), new RegExp(`${def}/${total}`), 'methods.md ρ\'sız/toplam sayısını söylemeli');
  });

  test('⭐ hero çipleri çevre→DBH→karbon zinciriyle birebir', () => {
    const circumference = +landing.match(/ÇEVRE (\d+(?:[.,]\d+)?) cm/)[1].replace(',', '.');
    const shownD = +landing.match(/→ DBH (\d+(?:[.,]\d+)?) cm/)[1].replace(',', '.');
    const H = +landing.match(/H (\d+(?:[.,]\d+)?) m/)[1].replace(',', '.');
    const C = +landing.match(/C (\d+(?:[.,]\d+)?) kg/)[1].replace(',', '.');
    const D=circumference/Math.PI;
    assert.ok(Math.abs(shownD-D)<0.01,`gösterilen DBH ${shownD}, çevre/π ${D}`);
    const rhoCtx = {};
    vm.createContext(rhoCtx);
    vm.runInContext(speciesRuntime() + ';this.G=GROUP_DEFAULT_RHO;', rhoCtx);
    const r = rhoCtx.G['\u0130BREL\u0130'] / 1000;
    const agb = 0.0673 * Math.pow(r * D * D * H, 0.976);
    const beklenen = agb * 1.26 * 0.47;
    assert.ok(Math.abs(beklenen - C) < 0.06, `çip C=${C} kg ama çevre→DBH motoru ${beklenen.toFixed(1)} kg üretiyor`);
    const hd = 100 * H / D;
    assert.ok(hd >= QA_LIMITS.HD_MIN && hd <= QA_LIMITS.HD_MAX,
      `vitrin örneği QA tipik bandında olmalı (h/D=${hd.toFixed(1)})`);
  });

  test('⭐ çap üst sınırı türetilmiş DBH üzerinde tek standart: 400 cm', () => {
    const protocol=rd('src/config/measurement-protocol-lock.js');
    assert.match(protocol,/max_diameter_cm:400/);
    assert.match(protocol,/max_circumference_cm:1256\.6370614359173/);
    assert.match(shell,/id="mDbh"[^>]*max="1256\.6"/);
    assert.match(landing,/Türetilmiş DBH ≤ 400 cm, boy ≤ 100 m/);
    assert.equal(QA_LIMITS.DBH_MAX_CM,400);
    assert.equal(QA_LIMITS.H_MAX_M,100);
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

describe('0036 · özellik ve EN bütünlük kilitleri', () => {
  const sh = rd('partials/shell.html');
  test("⭐ grup optionları value taşır (EN çevirisi veriyi bozamaz)", () => {
    assert.match(sh, /<option value="İBRELİ">İBRELİ<\/option>/);
    assert.match(sh, /<option value="YAPRAKLI">YAPRAKLI<\/option>/);
    assert.ok(!/<option value="DİĞER">/.test(sh), 'DİĞER yeni ölçüm grubu olamaz');
  });
  test('fillSpecies: ters sözlük savunması + alfabetik sıralama (T1)', () => {
    const m = rd('src/services/measure.js');
    assert.match(m, /DG_I18N_TR/, 'EN grup değeri TR kanoniğe çözülüyor');
    assert.match(m, /localeCompare\(String\(b\.tr\),"tr"\)/, 'tür listesi alfabetik (tr yereli)');
  });
  test('Kayıtlarım point sırası: proje alfabetik + point numerik (T1)', () => {
    assert.match(rd('src/services/dash.js'), /localeCompare\(String\(pb\),"tr"\)/);
    assert.match(rd('src/services/dash.js'), /point_id/, );
  });
  test('"Kayıt" çakışması giderildi: sekme "Kayıt Ol", tablo "Record"', () => {
    const i18nSrc = rd('src/config/i18n.js');
    assert.match(i18nSrc, /"Kayıt Ol":"Sign up"/);
    assert.ok(!/"Kayıt":"Sign up"/.test(i18nSrc), 'tablo başlığı Sign up olamaz');
    assert.match(rd('partials/landing.html'), />Kayıt Ol</);
  });
  test('T2 proje silme: ağaçta düğme + dgTreeDeleteProject + confirm + cascade bilgisi', () => {
    const a = rd('src/services/admin-tree.js');
    assert.match(a, /async function dgTreeDeleteProject/);
    assert.match(a, /dgTreeDeleteProject\(event,\$\{J\.project_id\}\)/);
    assert.match(a, /PROFILE\.role==="owner"\|\|PROFILE\.role==="admin"/, 'istemci kapısı');
    assert.match(a, /confirm\(/, 'onay isteniyor');
  });
  test('T3 yedekten yükle: dgRestorePick + SQL üretici + OVERRIDING SYSTEM VALUE', () => {
    const b = rd('src/services/backup.js');
    assert.match(b, /function dgRestorePick/);
    assert.match(b, /function dgRestoreSQL/);
    assert.match(b, /OVERRIDING SYSTEM VALUE/, 'identity kolonlarına özgün id yazımı');
    assert.match(b, /ON CONFLICT DO NOTHING/, 'idempotent');
    assert.match(b, /zenodo\.22948643/, 'yedek künyesinde güncel DOI');
    assert.match(sh, /dgRestorePick/, 'kabukta giriş noktası');
  });
  test('T4/0038 kurucuya özel Ziyaretçi & Canlı sekmesi (açılır kartlar KALDIRILDI)', () => {
    /* kullanıcı kararı: özet kartlar açılır OLMAYACAK; canlı izleme ayrı sekme */
    assert.ok(!sh.includes('dgAdminExpand'), 'açılır kart kablolaması kalktı');
    assert.ok(!sh.includes('admExpand'), 'admExpand kabuğu kalktı');
    assert.ok(!rd('src/services/admin.js').includes('dgAdminExpand'), 'admin.js temiz');
    assert.match(sh, /id="miVisitors"[^>]*style="display:none"/, 'sekme varsayılan gizli');
    assert.match(sh, /id="v-visitors"/);
    assert.match(sh, /id="visLive"/); assert.match(sh, /id="visMap"/); assert.match(sh, /id="visActivity"/);
    const sj = rd('src/ui/shell.js');
    assert.match(sj, /PROFILE\.role==="owner"&&\$\("miVisitors"\)/, 'YALNIZ KURUCU görür');
    assert.match(sj, /visitors:10/, 'go() indeks haritası');
    assert.match(sj, /loadVisitors/, 'go() yükleyici');
    const vs = rd('src/services/visit-stats.js');
    assert.match(vs, /async function loadVisitors/);
    assert.match(vs, /PROFILE\.role!=="owner"/, 'yükleyicide rol kapısı');
    assert.match(vs, /function renderVisitorsLive/);
    assert.match(vs, /function dgVisMapDraw/);
    assert.match(vs, /function dgPresenceStart/);
    assert.match(vs, /dg-presence/, 'presence kanalı');
    assert.match(rd('src/ui/shell.js'), /dgPresenceStart\(\)/, 'startShell kancası');
    assert.match(rd('src/ui/shell.js'), /dgPresencePing\(v\)/, 'go() kancası');
  });
  test('⭐ 0038 presence subscribe-önce + watchdog + konum alanı (connecting takılması kökten bitti)', () => {
    const vs = rd('src/services/visit-stats.js');
    /* kanal, getSession await'inden ÖNCE kurulmalı (takılma kök nedeni buydu) */
    assert.ok(vs.indexOf('sb.channel("dg-presence"') < vs.lastIndexOf('await sb.auth.getSession()'),
      'channel önce, auth arka planda');
    assert.match(vs, /WATCHDOG/, '8 sn bekçi köpeği');
    assert.match(vs, /p\.la=GPS\.latitude/, 'konum yalnız DG_LIVE_ON + GPS varsa');
    assert.match(rd('src/services/map.js'), /DG_LIVE_ON/, 'park ORTAK kanalı anahtara bağlı kalır (0040: kurucu görünümü anahtarsız)');
    const mp = rd('src/services/map.js');
    assert.ok(mp.indexOf('sb.channel("dg-park-"') < mp.indexOf('await sb.auth.getSession()'), 'park kanalı da subscribe-önce');
    assert.match(mp, /DG_PARK_CH_WATCH/, 'park kanalı watchdog');
    assert.match(mp, /DG_PARK_CH_LIVE/, 'track yalnız SUBSCRIBED sonrası');
  });
  test("T5 canlı konum: kanal park başına, DB ye yazmaz, UI kablolaması tamam", () => {
    const mp = rd('src/services/map.js');
    assert.match(mp, /function dgLiveShareJoinCurrent/);
    assert.match(mp, /function dgLiveSharePing/);
    assert.match(mp, /function dgLiveMatesDraw/);
    assert.match(mp, /dg-park-/, 'park başına kanal');
    assert.match(mp, /DG_MATE_COLORS/, 'ortak başına renk');
    assert.match(mp, /bindTooltip/, 'üstüne gelince kimlik');
    assert.ok(!/\.insert\(|\.upsert\(/.test(mp.slice(mp.indexOf('0036 (T5)'))), 'canlı konum DB\'ye YAZMAZ');
    assert.match(sh, /dgLiveShareToggle/, 'kabukta anahtar');
    assert.match(sh, /id="dgLiveShare"/);
    assert.match(sh, /id="dgMatesNote"/);
    assert.match(rd('src/services/park-registry.js'), /dgLiveShareJoinCurrent/, 'proje değişince kanal taşınır');
    assert.match(rd('src/services/measure.js'), /dgLiveSharePing/, 'GPS güncellemesi ping atar');
  });
  test('⭐ 0037 pinleri: kuyruk/rozet/panel çekirdek çevirileri sözlükte', () => {
    const i18nSrc = rd('src/config/i18n.js');
    for (const s of ['"Geri çekildi":"Retracted"', '"🚫 Reddet":"🚫 Reject"', '"✓ Onayla":"✓ Approve"',
      '"🌳 Park Algılama":"🌳 Park Detection"', '"Ortaklar":"Collaborators"', '"Bekliyor":"Waiting"',
      '"En Yaygın 6 Tür":"Top 6 Species"', '"Ölçüm fotoğrafı":"Measurement photo"'])
      assert.ok(i18nSrc.includes(s), 'eksik pin: ' + s);
    assert.match(i18nSrc, /"alt"\]/, 'alt özniteliği çevriliyor');
  });
  test('⭐ 0037 presence sertleştirme + durum görünürlüğü', () => {
    const vs = rd('src/services/visit-stats.js');
    assert.match(vs, /setAuth/, 'realtime JWT açıkça veriliyor');
    assert.match(vs, /Math\.min\(30000/, 'yeniden deneme aralığı sınırlı');
    assert.match(vs, /DG_PRES_GENERATION/, 'eski kanal olayları yeni bağlantıyı etkileyemez');
    assert.match(vs, /function dgPresenceState/, 'durum dışa açık');
    const vs2 = rd('src/services/visit-stats.js');
    assert.match(vs2, /dgPresenceState\(\)/, 'canlı kart durumu gösteriyor');
    const mp = rd('src/services/map.js');
    assert.match(mp, /DG_PARK_CH_RETRY/, 'canlı konum kanalı da yeniden dener');
    assert.match(rd('css/style.css'), /\.dg-switch/, 'temalı anahtar stili');
    assert.match(rd('partials/shell.html'), /class="dg-switch"/);
  });
  test('⭐ 0037 sıralama: admin düz liste + ağaç satırları point sıralı', () => {
    assert.match(rd('src/services/admin.js'), /sort\(\(a,b\)=>\(\(\+a\.project_id\|\|0\)-\(\+b\.project_id\|\|0\)\)\|\|\(\(\+a\.point_id\|\|0\)-\(\+b\.point_id\|\|0\)\)/);
    assert.match(rd('src/services/admin-tree.js'), /U2\.rows\.sort\(\(a,b\)=>\(\+a\.point_id\|\|0\)-\(\+b\.point_id\|\|0\)/);
  });
  test('yayın kuyruğu dinamik dizeleri dgCf ile çevriliyor', () => {
    const rp = rd('src/services/report-publish.js');
    assert.match(rp, /dgCf\("son kontrol"\)/);
    assert.match(rp, /dgCf\("yayın işi 5 dakikada bir çalışır"\)/);
    assert.match(rp, /dgCf\("geri çekildi"\)/);
  });
});

describe('i18n katmanı sözleşmesi (0035)', () => {
  const i18n = rd('src/config/i18n.js');
  test('sözlük kapsamlı ve çekirdek dizeler çevrili', () => {
    const n = (i18n.match(/":"/g) || []).length;
    assert.ok(n >= 150, 'EN sözlüğü en az 150 dize içermeli, bulunan: ' + n);
    for (const s of ['"Sistem":"System"', '"Çıkış":"Log out"', '"📊 Panel":"📊 Dashboard"',
      '"Giriş Yap":"Sign in"', '"Hesap Oluştur":"Create account"', '"Kayıtlarım":"My Records"',
      '"KARAÇAM":"BLACK PINE"', '"İBRELİ":"CONIFER"', '"SALKIM SÖĞÜT":"WEEPING WILLOW"'])
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
  test('⭐ dinamik şablonlar dgTf/dgT ile çevriliyor (0035c — EN modunda Türkçe kalmaz)', () => {
    assert.match(i18n, /function dgTf\(/, 'dgTf şablon çevirici tanımlı');
    for (const s of ['"✓ {n} onaylı kayıt yüklendi', '"📌 <b>{a}</b> waypoint kayıtlı',
      '"🌲 İbreli":"🌲 Conifer"', '"🍃 Yapraklı":"🍃 Broadleaf"', '"Dosya seç":"Choose file"',
      '"🏆 En İyi":"🏆 Best"', '"Taleplerim":"My Requests"'])
      assert.ok(i18n.includes(s), 'eksik şablon/çeviri: ' + s);
    /* Regresyon: 0035c'de yeniden adlandırma bir `_t(` kullanımını kaçırmıştı
     * → vm'de ReferenceError. Yardımcı adları dosyaya özgü ve TAM olmalı. */
    const w = rd('src/services/world.js'), a = rd('src/services/admin-tree.js');
    assert.match(w, /const _tw=/, 'world.js kendi yardımcısını tanımlar');
    assert.ok(!w.includes('${_t(') && !w.includes('(_t(') && !w.includes('+_t('), 'world.js içinde sahipsiz _t( kalmamalı');
    assert.match(a, /const _ta=/, 'admin-tree.js kendi yardımcısını tanımlar');
    assert.ok(!a.includes('${_t(') && !a.includes('(_t(') && !a.includes('+_t('), 'admin-tree.js içinde sahipsiz _t( kalmamalı');
  });
  test('KVKK rıza metni bilinçli olarak çevrilmiyor (hukuki metin TR kalır)', () => {
    assert.ok(!i18n.includes('onaylıyorum. Rızamı dilediğim zaman'), 'rıza metni sözlüğe EKLENMEMELİ');
  });
  test('⭐ uygulamada çevrilmemiş Türkçe toast/confirm KALMADI (0035d)', () => {
    const dictSrc = rd('src/config/i18n.js');
    const keys = new Set([...dictSrc.matchAll(/"((?:[^"\\]|\\.)+)":/g)]
      .map((m) => m[1].replace(/\\"/g, '"').replace(/\\n/g, '\n')));
    const TR = /[çğıöşüÇĞİÖŞÜ]/;
    const files = ['src/services/admin.js', 'src/services/admin-tree.js', 'src/services/auth.js',
      'src/services/backup.js', 'src/services/dash.js', 'src/services/data-requests.js',
      'src/services/export.js', 'src/services/map.js', 'src/services/measure.js',
      'src/services/park-invites.js', 'src/services/park-registry.js', 'src/services/report-publish.js',
      'src/services/world.js', 'src/services/landcover.js', 'src/ui/park-export.js',
      'src/ui/park-panel.js', 'src/ui/shell.js', 'src/ui/landing.js',
      /* 0037: tarama genişletildi — geofence/grid/offline/park-query/visit-stats */
      'src/services/geofence.js', 'src/services/grid-engine.js', 'src/services/offline.js',
      'src/services/park-query.js', 'src/services/visit-stats.js'];
    const bad = [];
    for (const f of files) {
      const t = rd(f);
      /* (1) düz toast("TR…") ve dgCf("TR…") → sözlükte olmalı (ham veya trim'li) */
      for (const m of t.matchAll(/(?:toast|dgCf)\("((?:[^"\\]|\\.)+)"/g)) {
        const s = m[1].replace(/\\"/g, '"').replace(/\\n/g, '\n');
        if (TR.test(s) && !keys.has(s) && !keys.has(s.trim())) bad.push(f + ' → ' + s.slice(0, 60));
      }
      /* tek tırnaklı toast('…') varyantı (offline.js deseni) */
      for (const m of t.matchAll(/toast\('((?:[^'\\]|\\.)+)'/g)) {
        const s = m[1].replace(/\\'/g, "'").replace(/\\n/g, '\n');
        if (TR.test(s) && !keys.has(s) && !keys.has(s.trim()) && !/_to[f]|dgCf/.test(s)) bad.push(f + " ['] → " + s.slice(0, 60));
      }
      /* (2) dgTfs("TR şablon {var}") → şablon anahtarı sözlükte olmalı */
      for (const m of t.matchAll(/dgTfs\("((?:[^"\\]|\\.)+)"/g)) {
        const s = m[1].replace(/\\"/g, '"').replace(/\\n/g, '\n');
        if (TR.test(s) && !keys.has(s)) bad.push(f + ' [şablon] → ' + s.slice(0, 60));
      }
      /* (3) confirm("TR…") YASAK — confirm(dgCf(…)) olmalı */
      for (const m of t.matchAll(/confirm\("((?:[^"\\]|\\.)+)"/g)) {
        if (TR.test(m[1])) bad.push(f + ' [confirm sarmalanmamış] → ' + m[1].slice(0, 60));
      }
    }
    assert.deepEqual(bad, [], 'çevrilmemiş kullanıcı dizeleri:\n' + bad.join('\n'));
  });
  test('⭐ dil değişince aktif görünüm yeniden çiziliyor + e-posta atfı güncel', () => {
    assert.match(rd('src/ui/shell.js'), /addEventListener\("dg:lang"/, 're-render kancası');
    const dr = rd('src/services/data-requests.js');
    assert.match(dr, /ŞİRİN, N\. & ŞİRİN, S\./, 'e-posta atfında doğru yazar sırası');
    assert.match(dr, /Version 3\.0\.0/, 'e-posta atfında güncel sürüm');
    assert.ok(!dr.includes('(Version 1.0.0)'), 'eski sürüm atfı kalmamalı');
  });
});

describe('0039 · CSP realtime kilidi', () => {
  test('⭐ connect-src açıkça tanımlı ve wss://*.supabase.co izinli (Realtime bloklanmasın)', () => {
    assert.match(head, /connect-src[^"]*wss:\/\/\*\.supabase\.co/, 'CSP wss izni');
    for (const o of ['https://*.supabase.co', 'https://nominatim.openstreetmap.org',
      'https://overpass-api.de', 'https://planetarycomputer.microsoft.com',
      'https://*.blob.core.windows.net', 'https://*.s3.us-west-2.amazonaws.com',
      'https://challenges.cloudflare.com', "'self'"]) {
      const meta = head.match(/Content-Security-Policy"\s+content="([^"]+)"/);
      assert.ok(meta, 'CSP meta etiketi var');
      const cs = (meta[1].split(/;\s*connect-src\s/)[1] || '');
      assert.ok(cs.includes(o), 'connect-src içinde eksik: ' + o);
    }
  });
});

describe('0040 · kaydırma koruması + ziyaretçi sekmesi zenginleştirme', () => {
  const rd2 = (p) => readFileSync(join(ROOT, p), 'utf8');
  test('⭐ dgScrollKeep/dgScrollRestore tanımlı ve yeniden çizen fonksiyonlar sarılı', () => {
    const c = rd2('src/config/constants.js');
    assert.match(c, /function dgScrollKeep/);
    assert.match(c, /function dgScrollRestore/);
    assert.match(c, /DG_SCROLL_SWITCHING/, 'sekme geçişi istisnası');
    assert.match(rd2('src/ui/shell.js'), /DG_SCROLL_SWITCHING=true/, 'go() geçiş bayrağı');
    const wrapped = [['src/services/admin.js', 'loadAdmin'], ['src/services/admin-tree.js', 'dgTreeDraw'],
      ['src/services/dash.js', 'loadRecords'], ['src/services/dash.js', 'renderAnalysis'],
      ['src/services/map.js', 'loadWaypoints'], ['src/services/report-publish.js', 'dgPubRender'],
      ['src/services/park-invites.js', 'dgCollabRender'], ['src/services/user-admin.js', 'loadUsers'],
      ['src/services/data-requests.js', 'loadRequests'], ['src/services/world.js', 'loadParkCompare'],
      ['src/services/park-registry.js', 'loadParkAdmin']];
    for (const [f, fn] of wrapped) {
      assert.match(rd2(f), new RegExp(fn + '__scroll'), f + ' → ' + fn + ' sarmalanmamış');
    }
  });
  test('⭐ ziyaretçi sekmesi: yenile düğmesi + 10 sn tik + zengin satır + odaklanma', () => {
    const sh = rd2('partials/shell.html');
    assert.match(sh, /onclick="dgVisRefresh\(\)"/, 'yenile düğmesi');
    const vs = rd2('src/services/visit-stats.js');
    assert.match(vs, /function dgVisRefresh/);
    assert.match(vs, /function dgVisTickStart/);
    assert.match(vs, /10000/, '10 sn otomatik tik');
    assert.match(vs, /function dgVisFocus/, 'satıra tıkla → haritada odaklan');
    assert.match(vs, /r:\(typeof PROFILE/, 'presence payloadunda rol');
    assert.match(rd2('src/ui/shell.js'), /dgVisTickStop/, 'sekmeden çıkınca tik durur');
  });
  test('⭐ konum paylaşımı: kurucu OTOMATİK (anahtarsız), ortak anahtarı yalnız park kanalı', () => {
    const vs = rd2('src/services/visit-stats.js');
    assert.ok(!/DG_LIVE_ON/.test(vs), 'kurucu görünümü anahtara bağlı DEĞİL');
    const sh = rd2('partials/shell.html');
    assert.match(sh, /park ekibiyle paylaş/i, 'anahtar metni yalnız ortakları söyler');
    assert.ok(!sh.includes('kurucu canlı haritada görür'), 'eski metin kalktı');
  });
});

describe('0041 · kaydırma window kök düzeltmesi + 0044 soket kaldırma', () => {
  test('⭐ dgScrollKeep/Restore WINDOW scrollY yakalıyor (0040 eksikliğinin kökü)', () => {
    const c = rd('src/config/constants.js');
    assert.match(c, /window\.scrollY/, 'window kaydırması yakalanmalı');
    assert.match(c, /window\.scrollTo\(0,y\.w\)/, 'window geri konmalı');
    const sj = rd('src/ui/shell.js');
    assert.match(sj, /dg_scrollw_/, 'kaldığın yer belleği window için de');
    assert.match(sj, /window\.scrollTo\(0,scw\)/, 'go() window konumunu geri koyar');
  });
  test('⭐ 0044: harici model soketi + yönetim kartı KÖKTEN SİLİNDİ (kullanıcı kararı: iz kalmasın)', () => {
    assert.ok(!existsSync(join(ROOT, 'src/services/species-ai.js')), 'modül dosyası silinmeli');
    assert.ok(!index.includes('species-ai'), 'index.html tag izi kalmamalı');
    assert.ok(!rd('sw.js').includes('species-ai'), 'CORE_ASSETS izi kalmamalı');
    assert.ok(!shell.includes('aiSuggest'), 'sonuç kutusu izi kalmamalı');
    assert.ok(!shell.includes('dgAiAdmin'), 'yönetim kartı kutusu izi kalmamalı');
    assert.ok(!shell.includes('AI Ağaç Algılama'), 'yönetim kartı başlığı izi kalmamalı');
    assert.ok(!rd('src/services/admin.js').includes('dgAiAdminRender'), 'loadAdmin çağrısı izi kalmamalı');
    const mj = rd('src/services/measure.js');
    assert.ok(!mj.includes('dgAiOnPhoto'), 'fotoğraf kancası izi kalmamalı');
    assert.ok(!rd('src/config/i18n.js').includes('AI Ağaç Algılama'), 'sözlük izi kalmamalı');
    /* Fotoğraf denetimi SAHADA ve TEK yerde: Yeni Ölçüm sekmesi, fotoğraf düğmesi. */
    assert.match(shell, /onchange="checkPhoto\(event\)"/, 'denetim fotoğraf düğmesine bağlı');
    assert.match(shell, /id="photoCheck"/, 'sonuç kutusu ölçüm formunda');
    assert.match(mj, /function dgPhotoScan/, 'çok sınıflı tarayıcı (saf fonksiyon)');
    assert.match(mj, /function dgPhotoGate/, 'kalibre kapı');
    assert.ok(!/vegR>=0\.25/.test(mj), 'eski %25 yeşil kapısı geri gelmemeli');
    assert.match(rd('sw.js'), /dendrogeo-sw-v2-r(?:6[2-9]|[7-9]\d|\d{3,})/, 'güncel çevrimdışı paket');
  });
  test('⭐ AKASYA kanonik tür (0042): listede + eşanlamlı gölgesi yok', () => {
    const sp = rd('src/config/species.js');
    assert.match(sp, /\{tr:"AKASYA",lat:"Acacia spp\.",rho:null\}/, 'AKASYA seçilebilir kayıt (ρ kaynak bekliyor → grup varsayılanı)');
    assert.ok(!/"AKASYA":"YALANCI AKASYA"/.test(sp), 'eski eşanlamlı gölgesi kaldırılmalı (kanonik adı ezerdi)');
    assert.match(sp, /YALANCI AKASYA/, 'Robinia ayrı tür olarak duruyor');
  });
});
