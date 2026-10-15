"use strict";
/* ===== DendroGeo v2 · src/services/auth.js =====
Giriş / kayıt / şifre sıfırlama / Turnstile / recovery modal */

/* --- BLOK 1: Şifre kurtarma dinleyicisi --- */
window.DG_AUTH_SESSION_STORE.create(()=>sb).onAuthStateChange(event=>
 window.DG_SHOW_PASSWORD_RECOVERY.show(event,()=>$('recoveryModal'))
);

/* --- BLOK 2: Form görünürlüğü + Turnstile --- */
function showAuth(tab){
 return window.DG_SHOW_AUTH_PANEL.show($("erisim"),$("authBox"),tab,{selectTab:authTab,schedule:(callback,delay)=>window.setTimeout(callback,delay)});
}
function authTab(t){
 return window.DG_SELECT_AUTH_TAB.select(t,{getElement:$,setTab:value=>{DG_AUTH_TAB=value;},markVisible:()=>{window._tsVisible=true;},loadCaptcha:loadTurnstileScript,initializeCaptcha:initTurnstile});
}
const TS = window.TS = {};
let DG_AUTH_TAB="login";
function loadTurnstileScript(){
 return window.DG_TURNSTILE_SCRIPT_LOADER.load({window,document,available:typeof turnstile!=="undefined",onLoad:initTurnstile});
}
function scheduleTurnstile(){
 return window.DG_TURNSTILE_CONTROLLER.schedule({window,document,load:loadTurnstileScript});
}
function initTurnstile(){
 return window.DG_TURNSTILE_CONTROLLER.initialize({window,api:typeof turnstile==="undefined"?null:turnstile,tab:DG_AUTH_TAB,widgets:TS,getElement:$,activateWidget:input=>window.DG_TURNSTILE_WIDGET.activate(input)});
}
window.DG_TURNSTILE_CONTROLLER.bindReady({document,schedule:scheduleTurnstile});
function tsToken(id){
return window.DG_TURNSTILE_TOKEN.read(id,{api:typeof turnstile==="undefined"?null:turnstile,widgets:TS});
}
function amsg(t,e){return window.DG_RENDER_AUTH_MESSAGE.render(t,e,$("authMsg"));}

/* --- BLOK 3: Giriş / kayıt / sıfırlama / çıkış --- */
async function doLogin(){
return window.DG_LOGIN_WITH_PASSWORD.execute({email:$('liEmail').value,password:$('liPass').value,token:tsToken,wait:ms=>new Promise(r=>setTimeout(r,ms)),showMessage:amsg,auth:window.DG_AUTH_SESSION_STORE.create(()=>sb),resetWidget:id=>turnstile.reset(TS[id]),setUser:user=>{USER=user;},setProfile:profile=>{PROFILE=profile;},loadProfile:id=>window.DG_AUTH_SESSION_STORE.create(()=>sb).loadProfile(id),startShell,isOnline:()=>navigator.onLine,schedule:setTimeout,syncOffline:syncOfflineData});
}
async function doRegister(){
 return window.DG_REGISTER_ACCOUNT.execute({name:$("rgName").value,email:$("rgEmail").value,password:$("rgPass").value,organization:$("rgOrg").value,consent:$("rgConsent"),token:tsToken,wait:ms=>new Promise(r=>setTimeout(r,ms)),showMessage:amsg,auth:window.DG_AUTH_SESSION_STORE.create(()=>sb),resetWidget:id=>turnstile.reset(TS[id]),redirectTo:window.location.origin+window.location.pathname.replace(/\/+$/,'')+"/",now:()=>new Date().toISOString()});
}
async function sendResetEmail(){
 return window.DG_SEND_PASSWORD_RESET_EMAIL.execute({email:$("rsEmail").value,token:tsToken,wait:ms=>new Promise(r=>setTimeout(r,ms)),showMessage:amsg,auth:window.DG_AUTH_SESSION_STORE.create(()=>sb),resetWidget:id=>turnstile.reset(TS[id]),redirectTo:window.location.origin+window.location.pathname.replace(/\/+$/,'')+"/"});
}
async function logout(){return window.DG_SIGN_OUT.execute({stopPresence:typeof dgPresenceStop==="function"?dgPresenceStop:null,signOut:()=>window.DG_AUTH_SESSION_STORE.create(()=>sb).signOut(),reload:()=>location.reload()});}

/* --- BLOK 4: Recovery modal --- */
function cancelRecovery(){
window.DG_SHOW_PASSWORD_RECOVERY.hide(()=>$('recoveryModal'));
location.assign(window.location.pathname);
}
async function saveNewPassword(){
 return window.DG_SAVE_NEW_PASSWORD.execute({password:$("rcPass").value,confirmation:$("rcPass2").value,updatePassword:password=>window.DG_AUTH_SESSION_STORE.create(()=>sb).updatePassword(password),setMessage:(message,error)=>window.DG_RENDER_AUTH_MESSAGE.render(message,error,$("rcMsg")),toast,replaceHistory:()=>history.replaceState(null,"",window.location.pathname),reload:()=>location.reload()});
}

/* --- BLOK 5: GOOGLE İLE GİRİŞ (Supabase OAuth) ---
 * Kurulum (tek seferlik, kod değişikliği gerektirmez):
 *   1) Google Cloud Console → OAuth consent screen + Web application client
 *      → Authorized redirect URI: https://<proje-ref>.supabase.co/auth/v1/callback
 *   2) Supabase → Authentication → Providers → Google → Enable (Client ID + Secret)
 *   3) Supabase → Authentication → URL Configuration → Site URL: https://dendrogeo.org
 *   Ayrıntı: docs/google-giris.md
 *
 * Turnstile BİLEREK yok: doğrulama Google'ın kendi ekranında yapılıyor.
 * (Turnstile yalnız parola formunda bot koruması için gerekli.) */
function dgIsOAuthCallback(){
 return window.DG_AUTH_OAUTH_CALLBACK.isCallback(window.location);
}

function dgOAuthError(){
 return window.DG_AUTH_OAUTH_ERROR.read(window.location.search);
}

/* OAuth geri dönüşünde supabase-js URL'deki ?code=… değerini ARKA PLANDA takas
 * eder; bu sırada getSession() null dönebilir. Takas bitmeden landing'e
 * düşersek kullanıcı "giriş olmadı" sanır → oturum gelene kadar beklenir.
 * INITIAL_SESSION boş gelirse (takas hâlâ sürebilir) kısa bir ek süre tanınır. */
function dgWaitForOAuthSession(timeoutMs){
 return window.DG_AUTH_OAUTH_SESSION.wait(window.DG_AUTH_SESSION_STORE.create(()=>sb),timeoutMs);
}

/* Adres çubuğundaki ?code=… kalıntısını temizle: yenilemede takas tekrar
 * denenmesin, ekran görüntüsünde/paylaşılan bağlantıda kod görünmesin. */
function dgCleanOAuthUrl(){
 return window.DG_CLEAN_OAUTH_URL.clean(window);
}

function dgShowOAuthWait(msg){
 return window.DG_AUTH_OAUTH_WAIT_UI.show($,msg);
}
function dgHideOAuthWait(){
 return window.DG_AUTH_OAUTH_WAIT_UI.hide($);
}

async function dgGoogleSignIn(){
 return window.DG_START_GOOGLE_SIGN_IN.start({
  setButtonDisabled:value=>{const button=$("googleBtn");if(button)button.disabled=value;},
  showMessage:(message,isError)=>amsg(message,isError?1:0),showWait:dgShowOAuthWait,hideWait:dgHideOAuthWait,
  redirectTo:()=>window.location.origin+window.location.pathname.replace(/\/+$/,'')+"/",
  signIn:options=>window.DG_AUTH_SESSION_STORE.create(()=>sb).signInWithOAuth(options)
 });
}

window.showAuth=showAuth;
window.authTab=authTab;
window.dgGoogleSignIn=dgGoogleSignIn;
window.dgIsOAuthCallback=dgIsOAuthCallback;
window.dgWaitForOAuthSession=dgWaitForOAuthSession;
window.dgCleanOAuthUrl=dgCleanOAuthUrl;
window.dgShowOAuthWait=dgShowOAuthWait;
window.dgHideOAuthWait=dgHideOAuthWait;
