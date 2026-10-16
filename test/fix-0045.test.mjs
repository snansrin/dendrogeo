/* fix-0045.test.mjs — SAHA SÜRTÜNMESİ PAKETİ BEKÇİLERİ (kullanıcı kararları)
 *
 * 1) Form ipucu kaldırıldı: "denetim: yeşil · kızıl/mor · …" satırı
 *    KULLANICI isteğiyle silindi ("bunu belirtmene gerek yok, kaldır").
 * 2) Park/proje hafızası: yenilemede son çalışılan park-proje KALIR
 *    ("en son hangisinde çalışılıyorsa onda kalsın"). Bellek CİHAZDA
 *    (localStorage) — sunucuda yeni alan/şema/RLS YOK (kırmızı çizgi).
 * 3) 📜 Son Etkinlik açılır-kapanır (durum hatırlanır).
 * 4) 👁 Gelişmiş CANLI izleme: oturum/cihaz/gezinti/aksiyon/konum izi —
 *    TÜMÜ presence payload'ında GEÇİCİ taşınır; DB'ye YAZILMAZ (insert yok),
 *    gizlilik metnindeki mevcut beyanla birebir uyumlu; yalnız kurucu okur.
 * 5) Hero karakterleri yarı-gerçekçi vektör: konum/boyut/palet/animasyon
 *    iskeleti (walkerA/B · legA-D · bendA · penA · tail · flash) DEĞİŞMEDİ.
 * NOT (kullanıcı kararı): bu paket için CHANGELOG girdisi YOK (silent).
 * Bekçiler burada; CI kilidi olarak kalır. */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');
const shell = rd('partials/shell.html');
const landing = rd('partials/landing.html');
const meas = rd('src/services/measure.js');
const vs = rd('src/services/visit-stats.js');
const i18n = rd('src/config/i18n-en.js') + '\n' + rd('src/config/i18n.js');

describe('0045 · form ipucu kaldırıldı', () => {
  test('⭐ ipucu satırı hiçbir yayın yüzeyinde yok', () => {
    for (const f of ['partials/shell.html', 'index.html'])
      assert.ok(!rd(f).includes('denetim: yeşil ·'), f + ' içinde ipucu kalmamalı');
    assert.ok(!i18n.includes('"denetim: yeşil'), 'sözlük girdisi de silinmeli');
    /* fotoğraf kutusu ve kanca yerinde (denetim çalışmaya devam eder) */
    assert.match(shell, /id="photoCheck"/);
    assert.match(shell, /data-dg-measure-action="photo-check"/);
    assert.match(rd('src/ui/measurement-form-actions.js'), /checkPhoto\(event\)/);
  });
});

describe('0045 · park/proje hafızası (yenilemede sıfırlanmaz)', () => {
  test('⭐ remember/restore tanımlı ve zincirde bağlı', () => {
    assert.match(meas, /const DG_LAST_PROJ_KEY="dg_last_proj"/, 'cihaz belleği anahtarı');
    assert.match(meas, /function dgProjectRemember/, 'yazıcı');
    assert.match(meas, /function dgProjectRestore/, 'okuyucu');
    assert.match(rd('src/adapters/trees/project-selection-memory.js'), /remember\(storage,key,id\)/, 'tercih adapter üzerinden yazılır');
    assert.match(rd('src/adapters/trees/project-selection-memory.js'), /restore\(storage,key,projects\)/, 'tercih adapter üzerinden ve proje listesiyle doğrulanır');
    assert.match(meas, /restore:dgProjectRestore/, 'liste renderer proje seçimini geri yükler');
    assert.match(meas, /rememberProject:dgProjectRemember/, 'kaydettiğinde hatırlar');
    assert.match(rd('src/services/park-registry.js'), /rememberProject:value=>\{if\(typeof dgProjectRemember==="function"\)dgProjectRemember\(value\);\}/, 'seçim değişince hatırlar');
  });
  test('⭐ KOŞULLU geri yükleme: silinmiş proje hortlamaz', () => {
    assert.match(rd('src/adapters/trees/project-selection-memory.js'), /projects\|\|\[\]\)\.every\(project=>String\(project\.id\)!==last\)/, 'id PROJ_LISTte yoksa seçilmez');
  });
  test('⭐ davranış (vm): geçerli id geri gelir, geçersiz id dokunmaz', () => {
    const els = { mProject: { value: '' }, nProject: { value: '' } };
    const store = { dg_last_proj: '7' };
    const ctx = {
      window: {},
      localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; } },
      $: (id) => els[id] || null,
      PROJ_LIST: [{ id: 7 }, { id: 9 }],
    };
    vm.createContext(ctx);
    vm.runInContext(rd('src/adapters/trees/project-selection-memory.js'), ctx);
    const start=meas.indexOf('const DG_LAST_PROJ_KEY='),end=meas.indexOf('function dgProjectOpenMeasure(',start);
    vm.runInContext(meas.slice(start,end)+';this.R=dgProjectRestore;this.W=dgProjectRemember;', ctx);
    ctx.R();
    assert.equal(els.mProject.value, '7', 'hatırlanan proje seçilmeli');
    assert.equal(els.nProject.value, '7', 'nav seçimi de eşitlenmeli');
    store.dg_last_proj = '404';
    els.mProject.value = '9';
    ctx.R();
    assert.equal(els.mProject.value, '9', 'olisteyde olmayan id mevcut seçimi ezmemeli');
    ctx.W(9);
    assert.equal(store.dg_last_proj, '9', 'yazıcı belleğe yazar');
  });
});

describe('0045 · Son Etkinlik açılır-kapanır', () => {
  test('⭐ toggle + sarmal + kalıcılık', () => {
    assert.match(shell, /id="visActToggle"/, 'toggle düğmesi');
    assert.match(shell, /aria-controls="visActivityWrap"/, 'erişilebilirlik bağı');
    assert.match(shell, /id="visActivityWrap"/, 'sarmal');
    assert.match(vs, /function dgVisActToggle/, 'aç/kapa facade');
    assert.match(vs, /function dgVisActRestore/, 'durum geri yükleme facade');
    assert.match(vs, /localStorage\.setItem\("dg_vis_act_open"/, 'durum cihazda');
    assert.match(vs, /dgVisActRestore\(\);/, 'sekme açılışında uygulanır');
  });
});

describe('0045 · gelişmiş canlı izleme — GEÇİCİ (DB yok)', () => {
  test('⭐ payload alanları: oturum/cihaz/gezinti/aksiyon/iz', () => {
    assert.match(vs, /const DG_SID=/, 'oturum kimliği');
    assert.match(vs, /DG_SESSION_START/, 'oturum başlangıcı');
    assert.match(vs, /DG_DEV_TAG/, 'cihaz etiketi');
    assert.match(vs, /p\.vh=DG_VIEW_HIST/, 'gezinti zinciri');
    assert.match(vs, /p\.act=DG_LAST_ACT/, 'son aksiyon');
    assert.match(vs, /p\.lh=DG_LOC_HIST/, 'geçici konum izi');
    assert.match(vs, /function dgPresenceView/, 'sekme kancası');
    assert.match(vs, /function dgPresenceAct/, 'aksiyon kancası');
  });
  test('⭐ aksiyonlar gerçek iş akışına bağlı (kaydet/park/export/yayın)', () => {
    assert.match(meas, /dgPresenceAct\(wasEdit\?"edit":"save"/, 'ölçüm kaydı (2 yol)');
    const parkRegistry = rd('src/services/park-registry.js');
    const parkRetry = rd('src/application/parks/retry-park-registration.js');
    assert.match(parkRegistry, /recordPresence:\(action,name\)=>\{if\(typeof dgPresenceAct==="function"/, 'park kimliği presence portu');
    assert.match(parkRetry, /ports\.recordPresence\("park",row\.name\)/, 'park kimliği kaydı');
    const ex = rd('src/services/export.js');
    for (const k of ['"export","CSV"', '"export","QGIS"', '"export","GeoJSON"']) assert.match(ex, new RegExp(k.replace(/[,"]/g, (m) => '\\' + m)), 'export ' + k);
    assert.match(rd('src/services/report-publish.js'), /dgPresenceAct\("publish"/, 'rapor yayını');
    assert.match(rd('src/ui/shell.js'), /dgPresenceView\(v\)/, 'go() gezinmeyi yazar');
  });
  test('⭐ KIRMIZI ÇİZGİ: izleme VERİTABANINA YAZMAZ', () => {
    assert.ok(!/\.insert\(/.test(vs), 'visit-stats içinde insert YOK (sayaç raw fetch)');
    const post = (vs.match(/method:"POST"/g) || []);
    assert.equal(post.length, 1, 'tek POST: site_visits sayaç (Faz 6)');
    assert.match(vs, /\/rest\/v1\/site_visits/, 'o da yalnız ziyaret sayacı');
    assert.ok(!/dg_act|dg_session|activity_log/.test(vs), 'yeni izleme tablosu YOK');
    assert.ok(!/from\("dg_/.test(vs), 'izleme için sorgu YOK');
  });
  test('⭐ kurucu yüzeyi: 📡 akış kartı + zengin satır + iz polizgisi', () => {
    assert.match(shell, /id="visFeed"/, 'aksiyon akışı kutusu');
    assert.match(shell, /id="visActivityWrap"/, 'son etkinlik sarmalı');
    assert.match(vs, /function dgVisFeed/, 'akış facade');
    assert.match(rd('src/ui/visitor-live-map.js'), /buildTrail/, 'harita görünümü iz adapterını kullanır');
    assert.match(rd('src/ui/visitor-activity-feed.js'), /events\.map/, 'akış UI modülü olayları çizer');
    assert.match(rd('src/ui/visitor-roster.js'), /deviceLabel/, 'satırda cihaz bilgisi UI portundan gelir');
    assert.match(rd('src/ui/visitor-action-labels.js'), /DG_VISITOR_ACTION_LABELS/, 'aksiyon etiketleri UI sözlüğündedir');
  });
  test('⭐ kullanıcıya duyuru YOK (silent karar): toast/landing/docs temiz', () => {
    const a = shell.indexOf('id="v-visitors"'), b = shell.indexOf('id="visFeed"');
    assert.ok(a > -1 && b > a, 'akış kartı yalnız kurucu sekmesinde (v-visitors)');
    const pub = rd('partials/landing.html');
    assert.ok(!pub.includes('Canlı Aksiyon'), 'landing duyurusu yok');
    assert.ok(!rd('CHANGELOG.md').includes('0045'), 'CHANGELOG girdisi yok (kullanıcı kararı)');
  });
});

describe('Hero öğrenciler: 2026-10-02 kullanıcı isteğiyle yenilenen yüzler, korunan sahne', () => {
  test('öğrenci çizimleri aynı SVG içinde; dış görsel veya yeni yükleyici yok', () => {
    const scene = landing.slice(landing.indexOf('<div class="hero-art"'), landing.indexOf('</svg>',landing.indexOf('<div class="hero-art"')));
    assert.match(scene, /viewBox="0 0 900 300"/);
    assert.equal((scene.match(/class="walkerA"/g) || []).length, 1);
    assert.equal((scene.match(/class="walkerB"/g) || []).length, 1);
    assert.doesNotMatch(scene, /<image\b|<script\b/);
    assert.equal((scene.match(/<foreignObject\b/g)||[]).length,3);
    assert.ok(scene.indexOf('class="dg-tree-readouts"')<scene.indexOf('class="walkerA"'));
    const ids = new Set([...scene.matchAll(/id="([^"]+)"/g)].map(m => m[1]));
    for (const m of scene.matchAll(/url\(#([^)]+)\)/g))
      assert.ok(ids.has(m[1]), 'eksik SVG boya tanımı: ' + m[1]);
    const css = rd('css/landing.css');
    assert.match(css, /\.hero-art\{position:absolute;left:0;top:-80px;width:100%;z-index:0;pointer-events:none;overflow:visible\}/);
    assert.match(css, /@media\(max-width:960px\)\{\s*\.hero-art\{display:none\}/);
  });
  test('⭐ kol/bacak YENİ (eklemli, doğal) + telefon senaryosu duruyor', () => {
    for (const c of ['class="legA"', 'class="legB"', 'class="legC"', 'class="legD"', 'class="armPhoneB"', 'class="phoneB"', 'class="headB"', 'class="bobA"', 'class="frameWin"'])
      assert.ok(landing.includes(c), 'eksik: ' + c);
    assert.ok(!landing.includes('<rect class="legA" x="623"'), 'bacaklar artık blok dikdörtmen değil');
    assert.ok(!landing.includes('<rect x="636" y="174" width="14" height="6"'), 'kollar artık blok dikdörtmen değil');
    const lcss = rd('css/landing.css');
    for (const k of ['@keyframes phoneRaise', '@keyframes gazeB', '@keyframes frameWinA', '@keyframes bob'])
      assert.match(lcss, new RegExp(k.replace(/[()]/g, (x) => '\\' + x)), 'senaryo katmanı: ' + k);
    assert.match(lcss, /@keyframes visitA\{0%\{transform:translateX\(-600px\);opacity:0\}/, 'özgün yürüyüş korunur');
    assert.match(lcss, /@keyframes bend\{0%,22%,52%,100%\{transform:rotate\(0\)\}28%,46%\{transform:rotate\(8deg\)\}/, 'eğilme AĞACA doğru (ölçüm duruşu)');
    assert.ok(landing.includes('x1="599" y1="152" x2="676" y2="60"'), 'görüş çizgisi telefon lensinden ağaç tepesine');
  });
  test('⭐ reddedilen deneme katmanları GERİ GELMEZ (0046-0050 çöplüğü)', () => {
    for (const k of ['blinkA', 'blinkB', 'headA', 'dgSkinA', 'dgVest', 'dgJack', 'rx="1.9" ry="2.2"'])
      assert.ok(!landing.includes(k), 'kalıntı: ' + k);
    const lcss = rd('css/landing.css');
    for (const k of ['blinkA', 'headAk', 'translateX(-600px) rotate(', 'rotate(-38deg)'])
      assert.ok(!lcss.includes(k), 'css kalıntısı: ' + k);
  });
});

describe('0045 · i18n + sürüm sözleşmesi', () => {
  test('⭐ yeni etiketler EN sözlüğünde', () => {
    for (const s of ['📡 Canlı Aksiyon Akışı', 'çevrimiçi oldu', 'görüntüledi', 'ölçüm kaydetti', 'park algıladı', 'dışa aktardı', 'rapor yayını istedi', 'oturum', 'gezinti', 'son eylem', 'iz', '⬆ Gizle', '⬇ Göster'])
      assert.ok(i18n.includes(JSON.stringify(s) + ':'), 'eksik EN: ' + s);
  });
  test('⭐ içerik değişti → sw r62 veya sonrası', () => {
    assert.match(rd('sw.js'), /CACHE_VERSION = 'dendrogeo-sw-v2-r(?:6[2-9]|[7-9]\d|\d{3,})'/);
  });
});
