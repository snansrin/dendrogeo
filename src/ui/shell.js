"use strict";
/* DendroGeo · ui/shell.js — uygulama kabuğunun önyüklemesi.
 * index.html inline script'inden birebir taşındı (Faz 1): boot() (SW kaydı,
 * persist, online dinleyici, ziyaret sayacı, oturum + recovery akışı),
 * startShell() ve go() sekme yönlendiricisi. Dosya sonunda boot() çağrılır —
 * eskiden inline script'in son satırındaki çağrıyla aynı zamanlama. */
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

async function startShell(){
$("landing").style.display="none";$("shell").style.display="block";
 if(PROFILE){$("whoami").textContent=PROFILE.full_name;
  if(PROFILE.role==="admin"||PROFILE.role==="owner"){$("roleBadge").style.display="inline";$("roleBadge").textContent=PROFILE.role==="owner"?"KURUCU":"ADMIN";$("roleBadge").className=PROFILE.role==="owner"?"badge on":"badge admin";$("adminSec").style.display="block";$("miAdmin").style.display="flex";$("miUsers").style.display="flex";}}
initMaps();
await loadProjects();
await loadWaypoints();
loadDash();loadRecords();loadWorld();loadMyRequests();loadRequestOptions();
 /* Yöneticiyse yan menüdeki 🔐 Ölçüm Yönetimi rozeti baştan güncel olsun
  * (onay bekleyen sayısı). Sekmeyi açmadan da "iş var" görünsün. */
 if(PROFILE&&(PROFILE.role==="admin"||PROFILE.role==="owner")&&typeof dgRefreshPendingBadge==="function")dgRefreshPendingBadge();
autoFillPointId();
}

function go(v){
 document.querySelectorAll(".view").forEach(x=>x.classList.remove("on"));
 $("v-"+v).classList.add("on");
 document.querySelectorAll("#side .item").forEach(i=>i.classList.remove("on"));
 const items=document.querySelectorAll("#side .item");
 const idx={dash:0,measure:1,nav:2,map:3,projects:4,records:5,export:6,world:7,admin:8,users:9};
if(items[idx[v]])items[idx[v]].classList.add("on");
if(v==="dash"){loadWaypoints().then(()=>loadDash());}
 /* Ölçüm sekmesi her açıldığında park kapısı tazelenir: seçili projenin parkı
  * yoksa form kilitli gelir ve kullanıcı park algılama ekranına yönlendirilir.
  * (2026-09-24 · park-registry.js dgParkGate) */
 if(v==="measure"&&typeof dgParkGate==="function")dgParkGate(true);
if(v==="map")setTimeout(()=>{map&&map.invalidateSize();if(!liveLoaded){liveLoaded=true;loadLiveMap();}},150);
 if(v==="nav")setTimeout(()=>{navMap&&navMap.invalidateSize();loadWaypoints();},150);
 if(v==="world")setTimeout(()=>worldMap&&worldMap.invalidateSize(),150);
if(v==="admin")loadAdmin();
if(v==="users")loadUsers();
if(v==="export")loadRequestOptions();
}

boot();
