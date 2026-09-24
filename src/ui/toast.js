"use strict";
/* DendroGeo · ui/toast.js — ortak bildirim baloncukları.
 * index.html inline script'inden birebir taşındı (Faz 1, modülerleştirme).
 * Tüm modüller (auth, admin, gridplan, landcover…) toast()'ı global çağırır;
 * bu dosya body sonunda, state.js'ten sonra ve shell.js'ten önce yüklenir. */
function toast(msg,type="ok",icon=""){
 const wrap=$("toastWrap");if(!wrap)return;
 const t=document.createElement("div");
 t.className="toast "+(type==="err"||type==="warn"||type==="info"?type:"");
 const ic=icon||(type==="err"?"❌":type==="warn"?"⚠":type==="info"?"ℹ":"✓");
 t.innerHTML=`<span class="icon">${ic}</span><span class="msg">${msg}</span><span class="x" onclick="this.parentNode.classList.add('bye');setTimeout(()=>this.parentNode.remove(),300)">✕</span>`;
 wrap.appendChild(t);
 setTimeout(()=>{if(t.parentNode){t.classList.add("bye");setTimeout(()=>t.remove(),300);}},4500);
}

async function boot(){
    // 1. Service Worker'ı kaydet (sadece bir kez)
    if('serviceWorker' in navigator && !window._swRegistered){
        window._swRegistered = true;

        navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'})
        .then(reg=>{
            // Force a single reload when a newly deployed worker takes control.
            // This prevents the current page from continuing to execute the
            // previous LULC bundle after a successful deployment.
            if(navigator.serviceWorker.controller){
                navigator.serviceWorker.addEventListener('controllerchange',()=>{
                    if(sessionStorage.getItem('dg_sw_runtime_reload')==='1')return;
                    sessionStorage.setItem('dg_sw_runtime_reload','1');
                    location.reload();
                },{once:true});
            }
            return reg.update();
        })
        .catch(e=>console.log('SW registration failed:',e));
    }
    
    // 1b. Kalıcı depolama izni iste.
    //     Çevrimdışı kuyruk IndexedDB'de tutuluyor ve FOTOĞRAF BLOB'larını da
    //     içeriyor (offline.js). Tarayıcılar bu veriyi "best effort" sayar:
    //     iOS Safari ana ekrana KURULMAMIŞ bir PWA'nın IndexedDB/localStorage
    //     verisini ~7 gün hareketsizlikten sonra silebilir, Android depolama
    //     baskısında temizleyebilir. persist() bu tahliyeyi engellemeyi ister.
    //     İzin verilmezse bu tercih sessizce kaydedilir; her sayfa yüklemesinde
    //     kullanıcıya uyarı gösterilmez. Saha kuyruğu için senkronizasyon rozeti
    //     ve çevrimiçi olduğunda otomatik senkronizasyon kullanılmaya devam eder.
    if (navigator.storage?.persist && !window._persistChecked) {
        window._persistChecked = true;
        navigator.storage.persist().then(ok => {
            window._storagePersisted = ok;
        }).catch(() => {});
    }
    
    // 2. Online listener SADECE BİR KEZ eklensin (çift toast önleme)
    if(!window._onlineListenerSet){
        window._onlineListenerSet = true;
        window.addEventListener('online',()=>{
            toast('İnternet bağlantısı geri geldi — senkronize ediliyor','ok','🌐');
            setTimeout(() => syncOfflineData(), 1500);
        });
    }
    
    // 3. Ziyaretçi sayacı (her zaman çalışsın, sessionStorage zaten kontrol ediyor)
    trackVisit();
    
    // 4. Oturum kontrolü
const{data:{session}}=await sb.auth.getSession();
const isRecovery=/type=recovery/.test(INITIAL_HASH);
if(isRecovery&&!session){
initLanding();
setTimeout(()=>{toast("Bu sıfırlama bağlantısı kullanılmış veya süresi dolmuş. Yeni bir sıfırlama maili isteyin.","warn","🔑");showAuth();authTab("reset");},400);
return;
}
if(!session){initLanding();return;}
USER=session.user;
// 🔑 Şifre sıfırlama linkinden geldiyse → yeni parola ekranını aç
if(isRecovery){
$("recoveryModal").style.display="flex";
return;
}
    
    // 5. Profil yükle ve arayüzü başlat
    const{data:p}=await sb.from("profiles").select("*").eq("id",USER.id).single();
    PROFILE=p;
    startShell();
    
    // 6. Online ise kuyruğu senkronize et
    if (navigator.onLine) {
        setTimeout(() => syncOfflineData(), 2000);
    }
}
