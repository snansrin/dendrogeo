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
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",initTurnstile);
else initTurnstile();
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
organization:$("rgOrg").value
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
