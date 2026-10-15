/* google-auth.test.mjs — GOOGLE İLE GİRİŞ KİLİDİ (2026-09-24)
 *
 * Akışın çalışma zamanı testleri test/park-flow.test.mjs bölüm 11'de (sahte
 * supabase.auth ile signInWithOAuth çağrısı, ?code= algılama, takas bekleme).
 * Buradaki kilitler KABUK + BELGELEME tarafı:
 *
 *   1) Düğme landing'de, satır içi SVG logo ile (dış kaynak YOK: CSP +
 *      çevrimdışı + PWA). Dışarıdan logo çekilirse önizleme/PWA'da görünmez.
 *   2) redirectTo sabit bir adres DEĞİL, origin+pathname'den üretiliyor
 *      (yerel önizleme/alt sayfa bozulmasın; açık yönlendirme kapısı olmasın).
 *   3) OAuth yolunda Turnstile YOK (Google kendi doğrulamasını yapar; ikinci
 *      captcha gereksiz sürtünme). Parola formundaki Turnstile korunuyor.
 *   4) Kurulum rehberi repoda: Google Cloud + Supabase ayarları yapılmadan
 *      özellik çalışmaz ve bunun tek kaynağı docs/google-giris.md.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const idx = readFileSync(join(ROOT, 'index.html'), 'utf8');
const auth = readFileSync(join(ROOT, 'src/services/auth.js'), 'utf8');
const googleFlow = readFileSync(join(ROOT, 'src/application/auth/start-google-sign-in.js'), 'utf8');
const css = readFileSync(join(ROOT, 'css/style.css'), 'utf8');
const DOC = join(ROOT, 'docs/google-giris.md');

describe('Google ile giriş — kabuk', () => {
  test('⭐ düğme landing’de ve handler’ı tanımlı', () => {
    assert.match(idx, /id="googleBtn"[^>]*data-dg-landing-action="google-sign-in"/);
    assert.match(idx, /Google ile devam et/);
    assert.match(auth, /async function dgGoogleSignIn\(/);
    assert.match(auth, /window\.dgGoogleSignIn=dgGoogleSignIn;/);
  });

  test('düğme parola sekmelerinin ÜSTÜNDE (önce OAuth, sonra "veya")', () => {
    const g = idx.indexOf('id="googleBtn"');
    const tabs = idx.indexOf('data-dg-auth-mode="login"');
    const sep = idx.indexOf('dg-oauth-sep');
    assert.ok(g > -1 && sep > -1 && tabs > -1, 'öğeler bulunamadı');
    assert.ok(g < sep && sep < tabs, `sıra bozuk: google=${g} sep=${sep} tabs=${tabs}`);
  });

  test('⭐ logo satır içi SVG — dış kaynak YOK (CSP/çevrimdışı/PWA)', () => {
    const seg = idx.slice(idx.indexOf('id="googleBtn"'), idx.indexOf('id="googleBtn"') + 1600);
    assert.match(seg, /<svg[^>]*viewBox="0 0 48 48"/);
    /* Google'ın dört rengi de yerinde mi (marka yönergesi) */
    for (const c of ['#EA4335', '#4285F4', '#FBBC05', '#34A853']) {
      assert.ok(seg.includes(c), 'eksik renk: ' + c);
    }
    assert.ok(!/<img[^>]*(google|gstatic)/i.test(idx), 'dışarıdan logo çekilmemeli');
    assert.ok(!/https:\/\/(www\.)?googleapis|accounts\.google\.com/.test(idx), 'index.html Google origin’i yüklememeli');
  });

  test('bekleme şeridi var (takas sürerken kullanıcı ne olduğunu görür)', () => {
    assert.match(idx, /id="oauthWait" class="dg-oauth-wait" style="display:none"/);
    assert.match(css, /\.dg-oauth-wait\{/);
    assert.match(auth, /function dgShowOAuthWait\(/);
    assert.match(auth, /function dgHideOAuthWait\(/);
  });

  test('stil: Google buton yönergesi (açık zemin, koyu metin, ince kenarlık)', () => {
    assert.match(css, /\.dg-google\{[^}]*background:#fff/);
    assert.match(css, /\.dg-google\{[^}]*border:1px solid #dadce0/);
    assert.match(css, /\.dg-google:disabled\{/);
    assert.match(css, /\.dg-oauth-sep:before,\.dg-oauth-sep:after\{/);
  });
});

describe('Google ile giriş — auth.js', () => {
  test('⭐ OAuth Supabase işlemini uygulama akışına, oturumu auth adapterına bırakıyor', () => {
    assert.match(googleFlow, /ports\.signIn\(\{provider:"google"/);
    assert.match(auth, /signIn:options=>window\.DG_AUTH_SESSION_STORE\.create\(\(\)=>sb\)\.signInWithOAuth\(options\)/);
    assert.doesNotMatch(auth, /sb\.auth\.signInWithOAuth\(/);
    assert.match(googleFlow, /const redirectTo=ports\.redirectTo\(\)/);
    assert.match(auth, /redirectTo:\(\)=>window\.location\.origin\+window\.location\.pathname/);
    assert.ok(!/redirectTo:\s*["']https?:\/\//.test(auth), 'redirectTo SABİT yazılmamalı (açık yönlendirme/alt sayfa riski)');
  });

  test('hesap seçimi açık (sahada ortak tablet kullanılıyor)', () => {
    assert.match(googleFlow, /queryParams:\{prompt:"select_account"\}/);
  });

  test('⭐ OAuth yolunda Turnstile YOK, parola yolunda DURUYOR', () => {
    const fn = auth.slice(auth.indexOf('async function dgGoogleSignIn'), auth.indexOf('window.showAuth='));
    assert.ok(!/tsToken|turnstile/.test(fn), 'OAuth akışında captcha olmamalı');
    assert.match(auth, /token:tsToken/,'parola girişinde captcha use-case girdisi korunur');
  });

  test('OAuth flow için PKCE ve callback sonrası açık URL temizliği', () => {
    const config=readFileSync(join(ROOT,'src/config/supabase.js'),'utf8');
    assert.match(config,/flowType:AUTH_FLOW_TYPE/);
    assert.match(config,/"implicit":"pkce"/);
    assert.match(config,/detectSessionInUrl:true/);
    const shell=readFileSync(join(ROOT,'src/ui/shell.js'),'utf8');
    assert.match(shell,/if\(typeof dgCleanOAuthUrl==="function"\)dgCleanOAuthUrl\(\)/);
  });

  test('hata durumunda düğme kilitli kalmıyor + rehber gösteriliyor', () => {
    assert.match(googleFlow, /ports\.setButtonDisabled\(false\)/);
    assert.match(googleFlow, /docs\/google-giris\.md/);
    assert.match(auth, /dgHideOAuthWait\(\)/);
  });

  test('?code= kalıntısı temizleniyor (yenileme/ekran görüntüsü güvenliği)', () => {
    assert.match(auth, /function dgCleanOAuthUrl\(/);
    assert.match(auth, /history\.replaceState\(null,"",window\.location\.pathname\)/);
  });
});

/* OAuth tests follow the modular use case; the legacy service remains a bridge only. */
describe('OAuth modular composition', () => {
  test('service delegates to application flow and does not own provider policy', () => {
    assert.match(auth, /async function dgGoogleSignIn\(/);
    assert.match(auth, /window\.DG_START_GOOGLE_SIGN_IN\.start\(/);
    assert.doesNotMatch(auth, /sb\.auth\.signInWithOAuth\(/);
    assert.match(auth, /window\.dgGoogleSignIn=dgGoogleSignIn;/);
  });
});

/*
  Previous assertions on auth.js duplicated OAuth policy in the service facade.
  Provider flow details now live in src/application/auth/start-google-sign-in.js.
*/
/*
  test('⭐ signInWithOAuth provider:google + redirectTo origin’den türetiliyor', () => {
    assert.match(auth, /sb\.auth\.signInWithOAuth\(\{/);
    assert.match(auth, /provider:"google"/);
    assert.match(auth, /const redirectTo=window\.location\.origin\+window\.location\.pathname/);
    assert.ok(!/redirectTo:\s*["']https?:\/\//.test(auth), 'redirectTo SABİT yazılmamalı (açık yönlendirme/alt sayfa riski)');
  });

  test('hesap seçimi açık (sahada ortak tablet kullanılıyor)', () => {
    assert.match(auth, /queryParams:\{prompt:"select_account"\}/);
  });

  test('⭐ OAuth yolunda Turnstile YOK, parola yolunda DURUYOR', () => {
    const fn = auth.slice(auth.indexOf('async function dgGoogleSignIn'), auth.indexOf('window.dgGoogleSignIn'));
    assert.ok(!/tsToken|turnstile/.test(fn), 'OAuth akışında captcha olmamalı');
    assert.match(auth, /tsToken\("tsLogin"\)/, 'parola girişinde Turnstile korunmalı');
  });

  test('OAuth flow için PKCE ve callback sonrası açık URL temizliği', () => {
    const config=readFileSync(join(ROOT,'src/config/supabase.js'),'utf8');
    assert.match(config,/flowType:AUTH_FLOW_TYPE/);
    assert.match(config,/"implicit":"pkce"/);
    assert.match(config,/detectSessionInUrl:true/);
    const shell=readFileSync(join(ROOT,'src/ui/shell.js'),'utf8');
    assert.match(shell,/if\(typeof dgCleanOAuthUrl==="function"\)dgCleanOAuthUrl\(\)/);
  });

  test('hata durumunda düğme kilitli kalmıyor + rehber gösteriliyor', () => {
    assert.match(googleFlow, /ports\.setButtonDisabled\(false\)/);
    assert.match(googleFlow, /docs\/google-giris\.md/);
    assert.match(auth, /dgHideOAuthWait\(\)/);
  });

  test('?code= kalıntısı temizleniyor (yenileme/ekran görüntüsü güvenliği)', () => {
    assert.match(auth, /function dgCleanOAuthUrl\(/);
    assert.match(auth, /history\.replaceState\(null,"",window\.location\.pathname\)/);
  });
});
*/

describe('Google ile giriş — kurulum rehberi', () => {
  test('docs/google-giris.md var', () => {
    assert.ok(existsSync(DOC), 'rehber yok — özellik panel ayarı olmadan çalışmaz');
  });

  test('rehber Supabase callback adresini birebir veriyor', () => {
    const doc = readFileSync(DOC, 'utf8');
    assert.match(doc, /https:\/\/xjbpounwdxrhelmixvqm\.supabase\.co\/auth\/v1\/callback/);
  });

  test('rehber kritik tuzakları içeriyor', () => {
    const doc = readFileSync(DOC, 'utf8');
    assert.match(doc, /In production/, 'OAuth consent yayınlanmazsa yalnız test kullanıcıları girebilir');
    assert.match(doc, /Allow manual linking/, 'mevcut e-posta/parola kullanıcıları için gerekli');
    assert.match(doc, /Site URL/, 'Supabase URL ayarı');
    assert.match(doc, /handle_new_user/, 'profil otomatik açılıyor (SQL gerekmez)');
    assert.match(doc, /dendrogeo\.org/, 'yetkili origin');
  });
});
