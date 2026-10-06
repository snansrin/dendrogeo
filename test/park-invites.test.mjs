/* park-invites.test.mjs — 0025 Park Çalışma Arkadaşı sözleşmeleri
 *
 * Kilitlenen davranışlar:
 *  1) SQL: davet açma/kabul/iptal YALNIZ SECURITY DEFINER RPC ile (tabloda
 *     insert/update/delete grant'i YOK); kabul = auth.uid() ↔ profiles.email;
 *     meas_select genişletmesi OR-bileşenli (daralma yok); 0006/0007 kapıları
 *     gevşemiyor.
 *  2) Modül (vm): 📬 kartı yalnız kendi e-postana açık davetleri gösterir;
 *     kabul RPC'si doğru ad/argümanla çağrılır ve proje listesini tazeler;
 *     👥 kartı parkları v_my_parks'tan doldurur; tablo yoksa (0025 SQL
 *     uygulanmamış) sessizce gizlenir — mevcut akış ASLA bozulmaz.
 *  3) Kablolama: index.html script sırası, shell go() kancaları, kartlar.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

/* ---------- vm önyükleme (report-publish.test deseninde, hafif) ---------- */
function boot(o = {}) {
  const els = {};
  const el = (id) => (els[id] ||= { id, innerHTML: '', style: {}, value: '', options: [], textContent: '' });
  for (const id of ['dgInvBox', 'dgSharedBox', 'dgInvPark', 'dgInvList', 'dgInvEmail', 'dgInvNote', 'dgOwnerCollabCard', 'projOwnCount', 'projSharedCount', 'projInviteCount', 'projTable']) el(id);
  /* Gerçek <select> innerHTML'e option yazılınca value'yu doldurur; stub'da
   * bu davranışı taklit et (modül sel.value'ya güveniyor). */
  {
    const sel = els.dgInvPark;
    let html = '';
    Object.defineProperty(sel, 'innerHTML', {
      get: () => html,
      set: (v) => { html = String(v); const m = /<option value="(\d+)"/.exec(html); sel.value = m ? m[1] : ''; },
    });
  }
  const calls = { rpc: [], toast: [], loadProjects: 0 };
  const ctx = {
    console: { log() {}, warn() {}, error() {} },
    USER: o.user === undefined ? { id: 'u1' } : o.user,
    PROFILE: o.profile === undefined ? { email: 'ben@ornek.com' } : o.profile,
    $: (id) => el(id),
    esc: (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])),
    toast: (m, k, i) => calls.toast.push(String(m)),
    loadProjects: () => { calls.loadProjects++; },
    sb: {
      from: (t) => ({
        select: () => {
          const chain = {
            eq: () => chain, order: () => chain, limit: () => chain, in: () => chain,
            then: (res) => res(Promise.resolve(
              t === 'park_invites' ? { data: o.invites ?? [], error: o.invitesError ?? null }
              : t === 'park_collaborators' ? { data: o.collabs ?? [], error: o.collabsError ?? null }
              : t === 'v_my_parks' ? { data: o.myParks ?? [], error: o.myParksError ?? null }
              : t === 'projects' ? { data: o.projects ?? [], error: o.projectsError ?? null }
              : { data: [], error: null })),
          };
          return chain;
        },
      }),
      rpc: async (fn, args) => { calls.rpc.push({ fn, args }); return o.rpcError ? { data: null, error: o.rpcError } : { data: o.rpcData ?? null, error: null }; },
    },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('src/services/park-invites.js'), ctx, { filename: 'park-invites.js' });
  return { ctx, els, calls };
}

describe('0025 · SQL sözleşmeleri (sunucu tarafı güvenlik)', () => {
  const sql = read('supabase/migrations/0025_park_invites.sql');
  test('yazma YALNIZ RPC: tablolara insert/update/delete grant YOK', () => {
    assert.ok(!/grant\s+(insert|update|delete)[^;]*park_invites/i.test(sql), 'park_invites yazma grantı olamaz');
    assert.ok(!/grant\s+(insert|update|delete)[^;]*park_collaborators/i.test(sql), 'park_collaborators yazma grantı olamaz');
    assert.match(sql, /grant select on public\.park_invites, public\.park_collaborators to authenticated/);
    assert.ok(!/to anon[^;]*park_invites/i.test(sql), 'davetler anon’a kapalı');
  });
  test('RPC’ler SECURITY DEFINER + kimlik/yetki denetimli', () => {
    for (const fn of ['dg_invite_send', 'dg_invite_respond', 'dg_invite_revoke'])
      assert.match(sql, new RegExp('function public\\.' + fn + '[\\s\\S]{0,400}security definer'), fn + ' definer');
    assert.match(sql, /INVITE_NOT_YOUR_PARK/, 'davet açma: park sahibi/admin şartı');
    assert.match(sql, /INVITE_NOT_YOURS/, 'kabul: davet bu hesaba ait olmalı (e-posta kimlik doğrulamaz)');
    assert.match(sql, /INVITE_SELF/, 'kendine davet engeli');
    assert.match(sql, /lower\(trim\(coalesce\(p_email/, 'e-posta normalize');
  });
  test('meas_select genişletmesi OR-bileşenli (mevcut görünürlük daralmaz)', () => {
    assert.match(sql, /status = 'Onaylı'/, 'anon Onaylı dalı korunur');
    assert.match(sql, /owner = auth\.uid\(\)/, 'kendi kayıt dalı korunur');
    assert.match(sql, /park_collaborators c\s*\n?\s*where c\.park_id = measurements\.park_id/, 'ortak park dalı');
    assert.ok(!/insert to anon/i.test(sql), 'anon yazma YOK');
  });
  test('durum kümesi kapalı + idempotent kalıplar', () => {
    assert.match(sql, /check \(status in \('Beklemede','Kabul','Red','İptal'\)\)/);
    assert.match(sql, /create table if not exists public\.park_invites/);
    assert.match(sql, /create table if not exists public\.park_collaborators/);
    assert.match(sql, /create or replace function public\.dg_invite_send/);
    assert.match(sql, /^begin;/m);
    assert.match(sql, /^commit;/m);
  });
});

describe('0025 · park-invites modülü (vm)', () => {
  const run = (ctx, code) => vm.runInContext('(async()=>{' + code + '})()', ctx);

  test('📬 kartı: yalnız KENDİ e-postana açık davetler listelenir', async () => {
    const { ctx, els } = boot({
      invites: [
        { id: 'i1', park_id: 25, email: 'ben@ornek.com', status: 'Beklemede', created_at: '2026-09-29T10:00:00Z', note: 'saha', parks: { name: 'Göksu Parkı' } },
        { id: 'i2', park_id: 5, email: 'baskasi@ornek.com', status: 'Beklemede', created_at: '2026-09-29T10:00:00Z', parks: { name: 'Başka Park' } },
      ],
    });
    await run(ctx, 'await dgInvitesLoadMine();');
    const h = els.dgInvBox.innerHTML;
    assert.ok(h.includes('Göksu Parkı'), 'kendi daveti görünür');
    assert.ok(!h.includes('Başka Park'), 'başkasının daveti SIZMAZ');
    assert.ok(h.includes("dgInviteRespond('i1',true)"), 'kabul düğmesi');
    assert.equal(els.dgInvBox.style.display, '', 'kart görünür');
  });

  test('davet yoksa 📬 kartı gizli kalır', async () => {
    const { ctx, els } = boot({ invites: [] });
    await run(ctx, 'await dgInvitesLoadMine();');
    assert.equal(els.dgInvBox.style.display, 'none');
  });

  test('giriş yokken hiçbir kart açılmaz', async () => {
    const { ctx, els } = boot({ user: null, invites: [{ id: 'x', email: 'ben@ornek.com', status: 'Beklemede', created_at: '2026-09-29T10:00:00Z', parks: {} }] });
    await run(ctx, 'await dgInvitesLoadMine();');
    assert.equal(els.dgInvBox.style.display, 'none');
    assert.equal(els.dgSharedBox.style.display, 'none');
  });

  test('kabul: doğru RPC + proje listesi tazelenir', async () => {
    const { ctx, calls } = boot({});
    await run(ctx, "await dgInviteRespond('i9',true);");
    /* deepEqual KULLANILMAZ: rpc kaydı vm realm'inden gelir (harness dersi) */
    assert.equal(calls.rpc[0].fn, 'dg_invite_respond');
    assert.equal(calls.rpc[0].args.p_invite, 'i9');
    assert.equal(calls.rpc[0].args.p_accept, true);
    assert.equal(calls.loadProjects, 1, 'kabul sonrası projeler yeniden yüklenir');
    assert.ok(calls.toast.some((t) => /Kabul/i.test(t)));
  });

  test('👥 sahibi ekranı: yalnız owner parkları seçicide, davet+ortak listeleri render', async () => {
    const { ctx, els } = boot({
      myParks: [{ id: 25, name: 'Göksu Parkı', city: 'Ankara', role: 'owner' }],
      invites: [{ id: 'i1', park_id: 25, email: 'ark@ornek.com', status: 'Beklemede', created_at: '2026-09-29T10:00:00Z' }],
      collabs: [{ user_id: 'u2', added_at: '2026-09-29T09:00:00Z', profiles: { full_name: 'Ayşe Y.', email: 'ayse@ornek.com' } }],
    });
    await run(ctx, 'await dgCollabLoad();');
    assert.equal(String(els.dgInvPark.innerHTML), '<option value="25">Göksu Parkı · Ankara</option>');
    assert.equal(els.dgOwnerCollabCard.style.display, '', 'proje sahibinde ekip yönetimi görünür');
    const h = els.dgInvList.innerHTML;
    assert.ok(h.includes('ark@ornek.com'), 'davet satırı');
    assert.ok(h.includes('Ayşe Y.'), 'ortak satırı');
    assert.ok(h.includes("dgInviteRevoke('u2','collab')"), 'ortak kaldırma düğmesi');
    assert.ok(h.includes("dgInviteRevoke('i1','invite')"), 'davet geri alma düğmesi');
  });

  test('davet gönder: boş e-posta gitmez; RPC doğru argümanla', async () => {
    const { ctx, els, calls } = boot({ myParks: [{ id: 25, name: 'G', role: 'owner' }] });
    await run(ctx, 'await dgCollabLoad();');
    els.dgInvEmail.value = '  ';
    await run(ctx, 'await dgInviteSend();');
    assert.equal(calls.rpc.filter((r) => r.fn === 'dg_invite_send').length, 0, 'boş e-posta RPC’ye gitmez');
    els.dgInvEmail.value = 'Arkadas@Ornek.com';
    els.dgInvNote.value = 'cumartesi';
    await run(ctx, 'await dgInviteSend();');
    const sent = calls.rpc.find((r) => r.fn === 'dg_invite_send');
    assert.ok(sent, 'dg_invite_send çağrıldı');
    assert.equal(sent.args.p_park, 25);
    assert.equal(sent.args.p_email, 'Arkadas@Ornek.com');
    assert.equal(sent.args.p_note, 'cumartesi');
    assert.equal(els.dgInvEmail.value, '', 'gönderim sonrası alan temiz');
  });

  test('ortak kullanıcı davet yönetimi ekranını GÖRMEZ ve RPC çağıramaz', async () => {
    const { ctx, els, calls } = boot({
      myParks: [{ id: 25, name: 'Göksu Parkı', city: 'Ankara', role: 'collaborator' }],
    });
    await run(ctx, 'await dgCollabLoad();');
    assert.equal(els.dgOwnerCollabCard.style.display, 'none', 'ortakta sahip yönetim kartı gizli');
    assert.ok(String(els.dgInvPark.innerHTML).includes('Sahibi olduğun proje yok'));
    els.dgInvPark.value = '25'; // DOM kurcalansa bile istemci kapısı çalışmalı
    els.dgInvEmail.value = 'x@ornek.com';
    await run(ctx, 'await dgInviteSend();');
    assert.equal(calls.rpc.filter((r) => r.fn === 'dg_invite_send').length, 0, 'ortak davet RPC çağramaz');
    assert.ok(calls.toast.some((t) => /yalnız proje sahibinde/i.test(t)));
  });

  test('karma rolde owner ve collaborator parkları AYRI tutulur', async () => {
    const { ctx, els } = boot({
      myParks: [
        { id: 25, name: 'Sahibi Olduğum', city: 'Ankara', role: 'owner' },
        { id: 31, name: 'Paylaşılan', city: 'Ankara', role: 'collaborator' },
      ],
    });
    await run(ctx, 'await dgCollabLoad();');
    assert.ok(String(els.dgInvPark.innerHTML).includes('Sahibi Olduğum'));
    assert.ok(!String(els.dgInvPark.innerHTML).includes('Paylaşılan'), 'ortak park ekip yönetimi seçicisine giremez');
  });

  test('0025 SQL uygulanmamışsa (tablo/view yok) SESSİZCE eski akış', async () => {
    const { ctx, els } = boot({ invitesError: { message: 'relation "public.park_invites" does not exist (42P01)' }, myParksError: { message: '42P01' } });
    await run(ctx, 'await dgInvitesLoadMine();');
    assert.equal(els.dgInvBox.style.display, 'none');
    await run(ctx, 'await dgCollabLoad();');
    assert.ok(els.dgInvPark.innerHTML.includes('Sahibi olduğun proje yok'), 'sahip yönetimi zarif düşer');
  });
});

describe('0025 · kablolama (index.html + shell + partials)', () => {
  test('index.html modülü report-publish’ten SONRA yükler', () => {
    const h = read('index.html');
    const a = h.indexOf('src/services/report-publish.js');
    const b = h.indexOf('src/services/park-invites.js');
    assert.ok(a > 0 && b > a, 'yükleme sırası');
  });
  test('shell go() kancaları typeof korumalı (0026: ikisi de v-projects)', () => {
    const sh = read('src/ui/shell.js');
    const ip = sh.indexOf('if(v==="projects"){');
    assert.ok(ip > 0, 'projeler sekmesi bloğu var');
    const blk = sh.slice(ip, ip + 220);
    assert.match(blk, /dgInvitesLoadMine/, '📬 yüklenir');
    assert.match(blk, /dgCollabLoad/, '👥 yüklenir');
    assert.ok(!/v==="admin"&&typeof dgCollabLoad/.test(sh), 'admin kancası kaldırıldı (kart projelerde)');
  });
  test('kartlar partials’ta: 📬 ve 👥 İKİSİ DE v-projects (0026 · kullanıcı isteği)', () => {
    const sh = read('partials/shell.html');
    const vp = sh.indexOf('id="v-projects"');
    const vrec = sh.indexOf('id="v-records"');
    const va = sh.indexOf('id="v-admin"');
    const inv = sh.indexOf('id="dgInvBox"');
    const collab = sh.indexOf('id="dgInvPark"');
    assert.ok(vp > 0 && inv > vp && inv < vrec, '📬 kartı v-projects içinde');
    assert.ok(collab > vp && collab < vrec, '👥 kartı v-projects içinde (admin değil)');
    assert.ok(va > 0 && !sh.slice(va).includes('dgInvPark'), '👥 kartı v-admin’de KALMADI');
    assert.ok(sh.indexOf('id="dgSharedBox"') > vp, 'paylaşılan park kutusu');
    assert.ok(sh.indexOf('id="projOwnList"') > vp, 'sahip projeleri ayrı liste');
    assert.ok(sh.indexOf('id="projSharedList"') > vp, 'ortak projeleri ayrı liste');
    assert.ok(sh.indexOf('id="dgOwnerCollabCard"') > vp, 'ekip yönetimi ayrı sahip kartı');
    assert.match(sh, /PROJE SAHİBİ/, 'sahip rolü görsel olarak açık');
    assert.match(sh, /ORTAK/, 'ortak rolü görsel olarak açık');
  });
  test('0026 mobil: tablolar dg-cards, .card overflow kalktı, üst bar sakinleşti', () => {
    const sh = read('partials/shell.html');
    assert.ok((sh.match(/tblwrap dg-cards/g) || []).length >= 6, 'tablo kalan ekranlarda mobil kart düzeni korunur; projeler ve Kayıtlarım artık özel kart/disclosure bileşenleri kullanır');
    assert.match(sh, /id="recGroups" class="records-groups"/, 'Kayıtlarım düz tablo yerine proje bazlı disclosure kullanır');
    assert.match(sh, /id="projTable" hidden/, 'eski entegrasyon hedefi görünmez uyumluluk için korunur');
    assert.match(sh, /id="projOwnList"/, 'proje sahipliği kart listesinde');
    assert.match(sh, /id="projSharedList"/, 'paylaşılan projeler ayrı kart listesinde');
    /* 0027: waypoint tablosu — kullanıcı bildirimi "içeride sağa-sola kayıyor" */
    assert.match(sh, /<ul id="wpListTable" class="waypoint-points"/, 'waypoint listesi kompakt nokta kartları kullanır');
    const mp = read('src/services/map.js');
    assert.match(mp, /data-label="Enlem"/, 'waypoint satırları etiketli');
    assert.match(mp, /data-label="İşlem"/);
    const ua = read('src/services/user-admin.js');
    assert.match(ua, /data-label="Ad Soyad"/, 'kullanıcı tablosu etiketli');
    const dr = read('src/services/data-requests.js');
    assert.match(dr, /data-label="Kapanış"/, 'talep tabloları etiketli');
    const css = read('css/style.css');
    /* yorum satırları çıkarılır (belgeleme amaçlı alıntılar kural sayılmasın) */
    const cssKod = css.split('\n').filter((l) => !l.trim().startsWith('/*') && !l.trim().startsWith('*')).join('\n');
    assert.ok(!cssKod.includes('.card{overflow-x:auto}'), '0026 öncesi hata: tüm kartlar kaydırma kabıydı');
    assert.match(css, /\.tblwrap\{overflow-x:auto/, 'yalnız tablo kabı kayar (mobilde)');
    assert.match(css, /#installBtn\{display:none!important\}/, 'üst bar mobilde sade');
    const m = read('src/services/measure.js');
    assert.match(m, /function dgProjectCard\(/, 'proje kart render yardımcısı');
    assert.match(m, /PROJE SAHİBİ/, 'sahip projesi rol rozeti');
    assert.match(m, /ORTAK/, 'paylaşılan proje rol rozeti');
    const d = read('src/services/dash.js');
    assert.match(d, /data-label="Karbon"/, 'kayıt satırları etiketli');
  });
  test('loadProjects paylaşım birleşimi: ortak projeleri dropdown’a ekler', () => {
    const m = read('src/services/measure.js');
    assert.match(m, /dgMyParks/, 'v_my_parks okunur');
    assert.match(m, /role==="collaborator"|role === "collaborator"/);
    assert.match(m, /q\.shared=true/, 'paylaşılan proje işaretlenir');
    assert.match(m, /Düzenleme ve ekip yönetimi proje sahibinde/, 'ortak kartında sahiplik sınırı açık');
    assert.match(m, /const own=PROJ_LIST\.filter\(p=>!p\.shared\), shared=PROJ_LIST\.filter\(p=>p\.shared\)/, 'sahip/paylaşılan projeler ayrı render edilir');
    assert.match(m, /owner:USER\.id/, 'ölçüm sahipliği değişmedi (kim ölçtü belli)');
  });
});
