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
const i18n = rd('src/config/i18n.js');

describe('0045 · form ipucu kaldırıldı', () => {
  test('⭐ ipucu satırı hiçbir yayın yüzeyinde yok', () => {
    for (const f of ['partials/shell.html', 'index.html'])
      assert.ok(!rd(f).includes('denetim: yeşil ·'), f + ' içinde ipucu kalmamalı');
    assert.ok(!i18n.includes('"denetim: yeşil'), 'sözlük girdisi de silinmeli');
    /* fotoğraf kutusu ve kanca yerinde (denetim çalışmaya devam eder) */
    assert.match(shell, /id="photoCheck"/);
    assert.match(shell, /onchange="checkPhoto\(event\)"/);
  });
});

describe('0045 · park/proje hafızası (yenilemede sıfırlanmaz)', () => {
  test('⭐ remember/restore tanımlı ve zincirde bağlı', () => {
    assert.match(meas, /const DG_LAST_PROJ_KEY="dg_last_proj"/, 'cihaz belleği anahtarı');
    assert.match(meas, /function dgProjectRemember/, 'yazıcı');
    assert.match(meas, /function dgProjectRestore/, 'okuyucu');
    assert.match(meas, /dgProjectRestore\(\);/, 'liste çizilince geri yüklenir');
    assert.match(meas, /dgProjectRemember\(pid\);/, 'kaydettiğinde hatırlar');
    assert.match(rd('src/services/park-registry.js'), /dgProjectRemember\(\$\("mProject"\)\.value\)/, 'seçim değişince hatırlar');
  });
  test('⭐ KOŞULLU geri yükleme: silinmiş proje hortlamaz', () => {
    assert.match(meas, /some\(p=>String\(p\.id\)===last\)/, 'id PROJ_LISTte yoksa seçilmez');
  });
  test('⭐ davranış (vm): geçerli id geri gelir, geçersiz id dokunmaz', () => {
    const stub = new Proxy(function () {}, { get: (t, p) => (p === Symbol.toPrimitive ? () => '' : stub), apply: () => stub, construct: () => stub, set: () => true });
    const els = { mProject: { value: '' }, nProject: { value: '' } };
    const store = { dg_last_proj: '7' };
    const ctx = {
      window: stub, document: stub, navigator: stub,
      localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; } },
      console: { log() {}, warn() {}, error() {} },
      $: (id) => els[id] || null,
      PROJ_LIST: [{ id: 7 }, { id: 9 }],
    };
    vm.createContext(ctx);
    vm.runInContext(meas + ';this.R=dgProjectRestore;this.W=dgProjectRemember;', ctx);
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
    assert.match(vs, /function dgVisActToggle/, 'aç/kapa');
    assert.match(vs, /function dgVisActRestore/, 'durum geri yükleme');
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
    assert.match(rd('src/services/park-registry.js'), /dgPresenceAct\("park"/, 'park kimliği');
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
    assert.match(shell, /Canlı Aksiyon Akışı/, 'kart başlığı');
    assert.match(vs, /function dgVisFeed/, 'akış çizici');
    assert.match(vs, /L\.polyline\(r\.p\.lh\.map/, 'haritada geçici iz');
    assert.match(vs, /r\.p\.dev/, 'satırda cihaz');
    assert.match(vs, /DG_ACT_LABELS/, 'aksiyon etiketleri');
  });
  test('⭐ kullanıcıya duyuru YOK (silent karar): toast/landing/docs temiz', () => {
    const a = shell.indexOf('id="v-visitors"'), b = shell.indexOf('id="visFeed"');
    assert.ok(a > -1 && b > a, 'akış kartı yalnız kurucu sekmesinde (v-visitors)');
    const pub = rd('partials/landing.html');
    assert.ok(!pub.includes('Canlı Aksiyon'), 'landing duyurusu yok');
    assert.ok(!rd('CHANGELOG.md').includes('0045'), 'CHANGELOG girdisi yok (kullanıcı kararı)');
  });
});

describe('0052 · hero: ÖZGÜN YÜZLER + istenen kol/bacak (kullanıcı: "yüz aynı kalsın, kol-bacak istediğim gibi")', () => {
  test('⭐ YÜZLER kullanıcının ilk çizimiyle BİREBİR', () => {
    for (const k of ['<circle cx="628" cy="158" r="9" fill="#f2c19a"/>',
                     '<circle cx="576" cy="156" r="9" fill="#e8b98a"/>',
                     '<path d="M619 156 a9 9 0 0 1 18 0 z" fill="#4a2f1d"/>',
                     '<path d="M567 154 a9 9 0 0 1 18 0 z" fill="#6d452c"/>',
                     '<circle cx="585" cy="151" r="5" fill="#6d452c"/>',
                     '<circle cx="585" cy="146" r="3" fill="#c2452d"/>',
                     '<circle cx="624" cy="158" r="1.2" fill="#182420"/>',
                     '<path d="M573 160 q3 2.5 6 0"'])
      assert.ok(landing.includes(k), 'özgün yüz öğesi eksik: ' + k);
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
  test('⭐ içerik değişti → sw r60', () => {
    assert.match(rd('sw.js'), /CACHE_VERSION = 'dendrogeo-sw-v2-r60'/);
  });
});
