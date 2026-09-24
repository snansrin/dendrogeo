"use strict";
/* ===== DendroGeo v2 · src/services/auth.js =====
Giriş / kayıt / şifre sıfırlama / Turnstile / recovery modal */

/* --- BLOK 1: Şifre kurtarma dinleyicisi --- */
sb.auth.onAuthStateChange((event)=>{
if(event==="PASSWORD_RECOVERY"){
const m=document.getElementById("recoveryModal");
if(m)m.style.display="flex";
}
});

/* --- BLOK 2: Form görünürlüğü + Turnstile --- */
function showAuth(){
const el=$("erisim");if(!el)return;
el.scrollIntoView({behavior:"smooth"});authTab("login");
const box=$("authBox");box.classList.remove("auth-glow");void box.offsetWidth;box.classList.add("auth-glow");
setTimeout(()=>box.classList.remove("auth-glow"),3000);
}
function authTab(t){
["login","reg","reset"].forEach(x=>{
const id="f"+x[0].toUpperCase()+x.slice(1);
if($(id))$(id).style.display=(x===t?"block":"none");
});
const tsId=t==="login"?"tsLogin":t==="reg"?"tsReg":"tsReset";
setTimeout(()=>{
if(TS[tsId]){try{turnstile.reset(TS[tsId]);}catch(e){}}
},120);
}
const TS = window.TS = {};
function loadTurnstileScript(){
 if(window._tsLoadStarted||typeof turnstile!=="undefined")return;
 window._tsLoadStarted=true;
 const s=document.createElement("script");
 s.src="https://challenges.cloudflare.com/turnstile/v0/api.js";
 s.async=true;
 document.head.appendChild(s);
}
function scheduleTurnstile(){
 const el=document.getElementById("erisim");
 if(!el||!("IntersectionObserver" in window)){loadTurnstileScript();return;}
 const io=new IntersectionObserver(es=>{
  if(es.some(e=>e.isIntersecting)){loadTurnstileScript();io.disconnect();}
 },{rootMargin:"300px"});
 io.observe(el);
}
function initTurnstile(){
if(typeof turnstile==="undefined"){setTimeout(initTurnstile,500);return;}
["tsLogin","tsReg","tsReset"].forEach(id=>{
const el=$(id);
if(el&&!TS[id]){
try{TS[id]=turnstile.render(el,{sitekey:"0x4AAAAAAEkJfXuFvNgUrwUb",theme:"light"});}
catch(e){console.log("TS render error",id,e);}
}
});
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>{initTurnstile();scheduleTurnstile();});
else{initTurnstile();scheduleTurnstile();}
function tsToken(id){
if(typeof turnstile==="undefined"||!TS[id])return null;
try{return turnstile.getResponse(TS[id])||null;}catch(e){return null;}
}
function amsg(t,e){const m=$("authMsg");if(m){m.textContent=t;m.style.color=e?"var(--red)":"var(--green-dk)";}}

/* --- BLOK 3: Giriş / kayıt / sıfırlama / çıkış --- */
async function doLogin(){
const email = $("liEmail").value;
const pass = $("liPass").value;
if(!email || !pass){
amsg("E-posta ve parola gerekli.", 1);
return;
}
amsg("Giriş yapılıyor...", 0);
let tok = tsToken("tsLogin");
if(!tok){
await new Promise(r => setTimeout(r, 2500));
tok = tsToken("tsLogin");
}
if(!tok){
amsg("Doğrulama widget'ı hazır değil. Sayfayı yenileyip tekrar deneyin.", 1);
return;
}
const r = await sb.auth.signInWithPassword({
email: email,
password: pass,
options: { captchaToken: tok }
});
if(r.error){
amsg(r.error.message, 1);
try { turnstile.reset(TS.tsLogin); } catch(e){}
return;
}
try { turnstile.reset(TS.tsLogin); } catch(e){}
USER = r.data.user;
const { data: p } = await sb.from("profiles").select("*").eq("id", USER.id).single();
PROFILE = p;
startShell();
if (navigator.onLine) {
setTimeout(() => syncOfflineData(), 2000);
}
}
async function doRegister(){
const name=$("rgName").value;
const email=$("rgEmail").value;
const pass=$("rgPass").value;
if(!name||!email||!pass){
amsg("Tüm alanları doldurun.",1);
return;
}
if(pass.length<6){
amsg("Parola en az 6 karakter olmalı.",1);
return;
}
/* ⛔ KVKK AÇIK RIZA (2026-09-24): onay kutusu işaretlenmeden hesap açılamaz.
 * Rıza yalnız UI'da kontrol edilmiyor; zaman damgasıyla auth metadata'sına da
 * yazılıyor → sonradan "ben onaylamadım" tartışmasında kayıt vardır. */
const consentEl=$("rgConsent");
if(consentEl&&!consentEl.checked){
amsg("Devam etmek için KVKK Aydınlatma Metni ve Gizlilik Politikası onay kutusunu işaretleyin.",1);
if(consentEl.focus)consentEl.focus();
return;
}
amsg("Hesap oluşturuluyor...",0);
let tok=tsToken("tsReg");
if(!tok){
await new Promise(r=>setTimeout(r,2500));
tok=tsToken("tsReg");
}
if(!tok){
amsg("Doğrulama widget'ı hazır değil. Sayfayı yenileyip tekrar deneyin.",1);
return;
}
const redirectURL = window.location.origin + window.location.pathname.replace(/\/+$/,"") + "/";
const r=await sb.auth.signUp({
email:email,
password:pass,
options:{
data:{
full_name:name,
organization:$("rgOrg").value,
/* KVKK rıza kaydı (denetim izi): neyi, ne zaman, hangi sürümü onayladı */
kvkk_consent:true,
kvkk_consent_at:new Date().toISOString(),
kvkk_consent_version:"1.0",
kvkk_consent_source:"kayit-formu"
},
captchaToken:tok,
redirectTo:redirectURL
}
});
if(r.error){
amsg(r.error.message,1);
return;
}
try{turnstile.reset(TS.tsReg);}catch(e){}
amsg(r.data.session?"Hesap oluşturuldu.":"✓ Doğrulama e‑postası gönderildi — maildeki linke tıklayın.",0);
}
async function sendResetEmail(){
const email=$("rsEmail").value;
if(!email){amsg("Lütfen e-posta adresinizi girin.",1);return;}
let tok=tsToken("tsReset");
if(!tok){
amsg("Widget yükleniyor, lütfen bekleyin...",0);
await new Promise(r=>setTimeout(r,2500));
tok=tsToken("tsReset");
}
if(!tok){amsg("Doğrulama widget'ı hazır değil. Sayfayı yenileyip tekrar deneyin.",1);return;}
amsg("Şifre sıfırlama talebi gönderiliyor...",0);
const redirectURL=window.location.origin+window.location.pathname.replace(/\/+$/,"")+"/";
try{
const r=await sb.auth.resetPasswordForEmail(email,{captchaToken:tok,redirectTo:redirectURL});
if(r&&r.error){
amsg("Hata: "+r.error.message,1);
try{turnstile.reset(TS.tsReset);}catch(e){}
return;
}
try{turnstile.reset(TS.tsReset);}catch(e){}
amsg("✓ Sıfırlama bağlantısı e-postanıza gönderildi. Spam klasörünü de kontrol edin.",0);
}catch(e){
amsg("Beklenmeyen hata: "+(e&&e.message?e.message:String(e)),1);
try{turnstile.reset(TS.tsReset);}catch(e2){}
}
}
async function logout(){await sb.auth.signOut();location.reload();}

/* --- BLOK 4: Recovery modal --- */
function cancelRecovery(){
$("recoveryModal").style.display="none";
location.assign(window.location.pathname);
}
async function saveNewPassword(){
const p1=$("rcPass").value,p2=$("rcPass2").value,m=$("rcMsg");
if(p1.length<6){m.textContent="Parola en az 6 karakter olmalı.";m.style.color="var(--red)";return;}
if(p1!==p2){m.textContent="Parololar eşleşmiyor.";m.style.color="var(--red)";return;}
const{error}=await sb.auth.updateUser({password:p1});
if(error){m.textContent="Hata: "+error.message;m.style.color="var(--red)";return;}
toast("✓ Parola güncellendi — yeni parolanızla giriş yapın","ok","🔑");
history.replaceState(null,"",window.location.pathname);
location.reload();
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
 const s=(typeof window!=="undefined"&&window.location&&window.location.search)||"";
 const h=(typeof window!=="undefined"&&window.location&&window.location.hash)||"";
 return /[?&]code=/.test(s)||/access_token=/.test(h)||/[?&]error=/.test(s);
}

function dgOAuthError(){
 const s=(typeof window!=="undefined"&&window.location&&window.location.search)||"";
 const m=/[?&]error=([^&]+)/.exec(s);
 return m?decodeURIComponent(m[1]):null;
}

/* OAuth geri dönüşünde supabase-js URL'deki ?code=… değerini ARKA PLANDA takas
 * eder; bu sırada getSession() null dönebilir. Takas bitmeden landing'e
 * düşersek kullanıcı "giriş olmadı" sanır → oturum gelene kadar beklenir.
 * INITIAL_SESSION boş gelirse (takas hâlâ sürebilir) kısa bir ek süre tanınır. */
function dgWaitForOAuthSession(timeoutMs){
 const ms=Number(timeoutMs)||9000;
 return new Promise(resolve=>{
  let done=false,sub=null,grace=null;
  const finish=s=>{
   if(done)return;
   done=true;
   if(grace)clearTimeout(grace);
   try{if(sub&&sub.subscription&&sub.subscription.unsubscribe)sub.subscription.unsubscribe();}catch(e){}
   resolve(s||null);
  };
  try{
   const r=sb.auth.onAuthStateChange((event,sess)=>{
    if(event==="SIGNED_IN"||event==="USER_UPDATED"){finish(sess);return;}
    if(event==="INITIAL_SESSION"){
     if(sess){finish(sess);return;}
     if(!grace)grace=setTimeout(()=>finish(null),1500);
    }
   });
   sub=(r&&r.data)||null;
  }catch(e){}
  /* Yarış koruması: takas zaten bittiyse getSession dolu döner */
  try{
   Promise.resolve(sb.auth.getSession()).then(r=>{
    const ses=r&&r.data?r.data.session:null;
    if(ses)finish(ses);
   }).catch(()=>{});
  }catch(e){}
  setTimeout(()=>finish(null),ms);
 });
}

/* Adres çubuğundaki ?code=… kalıntısını temizle: yenilemede takas tekrar
 * denenmesin, ekran görüntüsünde/paylaşılan bağlantıda kod görünmesin. */
function dgCleanOAuthUrl(){
 try{
  if(window.history&&window.history.replaceState){
   history.replaceState(null,"",window.location.pathname);
  }
 }catch(e){}
}

function dgShowOAuthWait(msg){
 const el=$("oauthWait");
 if(el){
  el.style.display="block";
  el.textContent=msg||"⏳ Google girişi tamamlanıyor…";
 }
}
function dgHideOAuthWait(){
 const el=$("oauthWait");
 if(el)el.style.display="none";
}

async function dgGoogleSignIn(){
 const btn=$("googleBtn");
 if(btn){btn.disabled=true;}
 amsg("Google'a yönlendiriliyorsun…",0);
 dgShowOAuthWait("🔵 Google'a yönlendiriliyorsun…");

 /* prompt=select_account: sahada ortak tablet kullanılıyor olabilir, kullanıcı
  * hangi Google hesabıyla gireceğini seçebilsin. */
 const redirectTo=window.location.origin+window.location.pathname.replace(/\/+$/,"")+"/";
 let error=null;
 try{
  const r=await sb.auth.signInWithOAuth({
   provider:"google",
   options:{
    redirectTo,
    queryParams:{prompt:"select_account"}
   }
  });
  error=r&&r.error?r.error:null;
 }catch(e){error=e;}

 if(error){
  if(btn){btn.disabled=false;}
  dgHideOAuthWait();
  const m=String(error.message||error);
  /* Sağlayıcı kapalıysa Supabase bunu söyler; kullanıcıya anlaşılır çevirisi */
  amsg(/provider.*not|disabled|not enabled/i.test(m)
   ? "Google girişi bu projede henüz etkin değil. Supabase → Authentication → Providers → Google → Enable (bkz. docs/google-giris.md)."
   : "Google girişi başlatılamadı: "+m,1);
  return;
 }
 /* Yönlendirme başladı; sayfa değişene kadar bekleme ekranı kalır. */
}

window.dgGoogleSignIn=dgGoogleSignIn;
window.dgIsOAuthCallback=dgIsOAuthCallback;
window.dgWaitForOAuthSession=dgWaitForOAuthSession;
window.dgCleanOAuthUrl=dgCleanOAuthUrl;
window.dgShowOAuthWait=dgShowOAuthWait;
window.dgHideOAuthWait=dgHideOAuthWait;
