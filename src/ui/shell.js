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
    /* GOOGLE/OAuth geri dönüşü (2026-09-24): supabase-js URL'deki ?code=…
     * değerini arka planda takas eder; o anda getSession() null döner.
     * Beklemezsek kullanıcı Google'dan döndüğü hâlde landing'i görür ve
     * "giriş olmadı" sanır. Takas bitene kadar dgWaitForOAuthSession bekler. */
    let session=null;
    if(typeof dgIsOAuthCallback==="function"&&dgIsOAuthCallback()){
        const oauthErr=(typeof dgOAuthError==="function")?dgOAuthError():null;
        if(oauthErr){
            dgShowOAuthWait("⚠ Google girişi iptal edildi veya başarısız: "+oauthErr);
            initLanding();
            setTimeout(()=>{toast(dgCf("Google girişi tamamlanamadı: ")+oauthErr,"err","🔵");},400);
            return;
        }
        dgShowOAuthWait();
        session=await dgWaitForOAuthSession();
        if(session&&typeof dgCleanOAuthUrl==="function")dgCleanOAuthUrl();
        if(typeof dgHideOAuthWait==="function")dgHideOAuthWait();
        if(!session){
            initLanding();
            setTimeout(()=>{toast("Google girişi tamamlanamadı — tekrar dene veya e-posta/parola ile gir.","warn","🔵");},400);
            return;
        }
    }else{
        const r=await sb.auth.getSession();
        session=r&&r.data?r.data.session:null;
    }
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
 /* 0036 (T4): canlı varlık kanalını aç (Realtime yoksa sessiz). */
 if(typeof dgPresenceStart==="function"){try{dgPresenceStart();}catch(e){}}
 /* kaydırma konumunu sekme bazında hatırla */
 const mainEl=$("main");
 if(mainEl&&!window._dgScrollHooked){window._dgScrollHooked=true;
  mainEl.addEventListener("scroll",()=>{try{localStorage.setItem("dg_scroll_"+DG_CUR_VIEW,String(mainEl.scrollTop));}catch(e){}},{passive:true});}
await loadProjects();
await loadWaypoints();
loadDash();loadRecords();loadWorld();loadMyRequests();loadRequestOptions();
 /* KALDIĞIN YERDEN DEVAM: yenilemede son açık sekme geri gelir.
  * OAuth/recovery akışlarında bu satıra gelinmez (yukarıda return var). */
 const lv=dgLastView();
 if(lv&&lv!=="dash"&&$("v-"+lv))setTimeout(()=>go(lv),250);
 /* Yöneticiyse yan menüdeki 🔐 Ölçüm Yönetimi rozeti baştan güncel olsun
  * (onay bekleyen sayısı). Sekmeyi açmadan da "iş var" görünsün. */
 if(PROFILE&&(PROFILE.role==="admin"||PROFILE.role==="owner")&&typeof dgRefreshPendingBadge==="function")dgRefreshPendingBadge();
autoFillPointId();
}

let DG_CUR_VIEW="dash";
/* KALDIĞIN YERDEN DEVAM (2026-09-27 · kullanıcı isteği): sayfa yenilenince
 * son açık sekme ve o sekmedeki kaydırma konumu geri gelir. localStorage
 * yerine sessionStorage DEĞİL: yenileme dışında tarayıcıyı kapat-aç da
 * kaldığı yeri bulsun istendi. Yazma/okuma hep try/catch (gizli modda
 * storage atabilir). */
function dgSaveView(v){try{localStorage.setItem("dg_last_view",v);}catch(e){}}
function dgLastView(){try{return localStorage.getItem("dg_last_view")||"";}catch(e){return "";}}
function go(v){
 DG_CUR_VIEW=v;dgSaveView(v);
 /* 0036: presence — "ne yapıyor" bilgisi tazelenir (geçici, DB'ye yazılmaz). */
 if(typeof dgPresencePing==="function"){try{dgPresencePing(v);}catch(e){}}
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
 if(v==="measure"&&typeof dgLiveShareJoinCurrent==="function")setTimeout(()=>{try{dgLiveShareJoinCurrent();}catch(e){}},400);
 /* CANLI HARİTA TAZELEME KAPISI (2026-09-26 · kullanıcı bildirimi):
  * ESKİ: if(!liveLoaded){liveLoaded=true;loadLiveMap();}
  *      → sekme bir oturumda YALNIZ BİR KEZ yükleniyordu. Yönetici ölçümü
  *        onaylayıp Canlı Harita'ya döndüğünde ESKİ küme çizili kalıyor,
  *        "onayladığım kayıt haritada yok" durumu F5'e kadar sürüyordu.
  * YENİ: ilk açılış VEYA veri bayatladıysa (onay/red/silme/senkronizasyon)
  *      yeniden çeker; bayat değilse gereksiz sorgu atılmaz. */
 if(v==="map")setTimeout(()=>{map&&map.invalidateSize();if(!liveLoaded||DG_LIVE_DIRTY)loadLiveMap();},150);
 if(v==="nav")setTimeout(()=>{navMap&&navMap.invalidateSize();loadWaypoints();},150);
 if(v==="world")setTimeout(()=>worldMap&&worldMap.invalidateSize(),150);
if(v==="admin")loadAdmin();
 /* 0025 · park çalışma arkadaşı: kartlar kendi modülünde (park-invites.js);
  * hook'lar typeof korumalı → modül yoksa eski davranış birebir. */
 /* 0026: 👥 davet kartı v-projects'te (kullanıcının yeri) — iki yükleme de
  * Projeler sekmesinde; admin sekmesi kancası kaldırıldı. */
 if(v==="projects"){
  if(typeof dgInvitesLoadMine==="function")dgInvitesLoadMine();
  if(typeof dgCollabLoad==="function")dgCollabLoad();
 }
if(v==="users")loadUsers();
if(v==="export")loadRequestOptions();
 /* kaydırma konumunu geri getir (sekme içeriği çizildikten sonra) */
 setTimeout(()=>{const m=$("main");if(!m)return;
  const sc=parseInt((()=>{try{return localStorage.getItem("dg_scroll_"+v)||"0";}catch(e){return "0";}})(),10);
  if(sc>0)m.scrollTop=sc;},180);
}

boot();

/* 0035d: DİL DEĞİŞİNCE aktif görünümü YENİDEN ÇİZ — dil düğmesine basıldığında
 * daha önce render edilmiş dinamik içerik (tablolar, waypoint satırı, park
 * kartları) eski dilde kalıyordu. go() kendi yükleyicilerini çalıştırır;
 * records/world go() içinde yeniden yüklenmediği için ayrıca çağrılır. */
window.addEventListener("dg:lang",()=>{try{
 if(typeof DG_CUR_VIEW==="undefined"||!DG_CUR_VIEW)return;
 const sh=$("shell");if(!sh||sh.style.display==="none")return;
 if(DG_CUR_VIEW==="records"&&typeof loadRecords==="function"){loadRecords();return;}
 if(DG_CUR_VIEW==="world"&&typeof loadWorld==="function"){loadWorld();return;}
 go(DG_CUR_VIEW);
}catch(e){}});
