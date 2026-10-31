"use strict";
/* DendroGeo · ui/shell.js — uygulama kabuğunun önyüklemesi.
 * index.html inline script'inden birebir taşındı (Faz 1): boot() (SW kaydı,
 * persist, online dinleyici, ziyaret sayacı, oturum + recovery akışı),
 * startShell() ve go() sekme yönlendiricisi. Dosya sonunda boot() çağrılır —
 * eskiden inline script'in son satırındaki çağrıyla aynı zamanlama. */
async function boot(){
 if(window.DG_SHELL_BOOT_CONTROLLER&&window.DG_INITIALIZE_SHELL_PLATFORM&&window.DG_RESOLVE_SHELL_SESSION)return window.DG_SHELL_BOOT_CONTROLLER.run({
  initializePlatform:()=>window.DG_INITIALIZE_SHELL_PLATFORM.initialize({window,navigator,schedule:(fn,delay)=>setTimeout(fn,delay),syncOfflineData,notify:toast,log:(...args)=>console.log(...args)}),trackVisit,
  resolveSession:()=>window.DG_RESOLVE_SHELL_SESSION.resolve({isOAuth:typeof dgIsOAuthCallback==="function"?dgIsOAuthCallback:null,getOAuthError:typeof dgOAuthError==="function"?dgOAuthError:null,showOAuthWait:dgShowOAuthWait,waitOAuth:dgWaitForOAuthSession,cleanOAuth:typeof dgCleanOAuthUrl==="function"?dgCleanOAuthUrl:null,hideOAuth:typeof dgHideOAuthWait==="function"?dgHideOAuthWait:null,getSession:()=>window.DG_AUTH_SESSION_STORE.create(()=>sb).getSession(),initialHash:INITIAL_HASH}),
  finishStartup:()=>window.DG_STARTUP_SCREEN?.finish(),showOAuthWait:dgShowOAuthWait,initLanding,schedule:(fn,delay)=>setTimeout(fn,delay),notify:toast,translate:dgCf,setUser:user=>{USER=user;},showAuth,resetAuth:()=>authTab("reset"),showRecovery:()=>{$("recoveryModal").style.display="flex";},
  startAuthenticated:window.DG_START_AUTHENTICATED_SESSION?user=>window.DG_START_AUTHENTICATED_SESSION.start({user,setUser:user=>{USER=user;},startShell:()=>startShell(),loadProfile:id=>window.DG_AUTH_SESSION_STORE.create(()=>sb).loadProfile(id),applyProfile:profile=>{PROFILE=profile;dgApplyShellProfile();if(typeof dgPresencePing==="function")dgPresencePing("dash",true);if(typeof dgRefreshPendingBadge==="function")dgRefreshPendingBadge();},onProfileError:error=>console.warn("DENDROGEO · Profil arka planda yüklenemedi:",error?.message||error)}):null,
  loadProfile:id=>window.DG_AUTH_SESSION_STORE.create(()=>sb).loadProfile(id),setProfile:profile=>{PROFILE=profile;},startShell,isOnline:()=>navigator.onLine,syncOfflineData
 });
    // 1. Service Worker'ı kaydet (sadece bir kez)
    if('serviceWorker' in navigator && !window._swRegistered){
        window._swRegistered = true;

        navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'})
        // Registration already checks changed worker bytes; avoid an extra
        // update request and defer the large offline-cache fill until idle.
        .then(reg=>{reg.update();setTimeout(()=>navigator.serviceWorker.ready.then(ready=>ready.active?.postMessage({type:'PRECACHE_REMAINING'})).catch(()=>{}),12000);})
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
            window.DG_STARTUP_SCREEN?.finish();
            dgShowOAuthWait("⚠ Google girişi iptal edildi veya başarısız: "+oauthErr);
            initLanding();
            setTimeout(()=>{toast(dgCf("Google girişi tamamlanamadı: ")+oauthErr,"err","🔵");},400);
            return;
        }
        dgShowOAuthWait();
        session=await dgWaitForOAuthSession();
        if(typeof dgCleanOAuthUrl==="function")dgCleanOAuthUrl();
        if(typeof dgHideOAuthWait==="function")dgHideOAuthWait();
        if(!session){
            initLanding();
            setTimeout(()=>{toast("Google girişi tamamlanamadı — tekrar dene veya e-posta/parola ile gir.","warn","🔵");},400);
            return;
        }
    }else{
        const r=await window.DG_AUTH_SESSION_STORE.create(()=>sb).getSession();
        session=r&&r.data?r.data.session:null;
    }
const isRecovery=/type=recovery/.test(INITIAL_HASH);
if(isRecovery&&!session){
window.DG_STARTUP_SCREEN?.finish();
initLanding();
setTimeout(()=>{toast("Bu sıfırlama bağlantısı kullanılmış veya süresi dolmuş. Yeni bir sıfırlama maili isteyin.","warn","🔑");showAuth();authTab("reset");},400);
return;
}
if(!session){window.DG_STARTUP_SCREEN?.finish();initLanding();return;}
USER=session.user;
// 🔑 Şifre sıfırlama linkinden geldiyse → yeni parola ekranını aç
if(isRecovery){
window.DG_STARTUP_SCREEN?.finish();
$("recoveryModal").style.display="flex";
return;
}
    
    // 5. Kimlik doğrulaması biter bitmez arayüzü aç; profil isteği arka planda.
    const startSession=window.DG_START_AUTHENTICATED_SESSION;
    if(startSession){
        startSession.start({
            user:USER,
            setUser:user=>{USER=user;},
            startShell:()=>startShell(),
            loadProfile:userId=>window.DG_AUTH_SESSION_STORE.create(()=>sb).loadProfile(userId),
            applyProfile:profile=>{PROFILE=profile;dgApplyShellProfile();if(typeof dgPresencePing==="function")dgPresencePing("dash",true);if(typeof dgRefreshPendingBadge==="function")dgRefreshPendingBadge();},
            onProfileError:error=>console.warn("DENDROGEO · Profil arka planda yüklenemedi:",error?.message||error)
        });
    }else{
        const{data:p}=await window.DG_AUTH_SESSION_STORE.create(()=>sb).loadProfile(USER.id);
        PROFILE=p;
        startShell();
    }
    
    // 6. Online ise kuyruğu senkronize et
    if (navigator.onLine) {
        setTimeout(() => syncOfflineData(), 2000);
    }
}

function dgApplyShellProfile(){
 if(!PROFILE)return;
 $("whoami").textContent=PROFILE.full_name||PROFILE.email||"";
 if(PROFILE.role!=="admin"&&PROFILE.role!=="owner"){dgResumePendingView();return;}
 $("roleBadge").style.display="inline";
 $("roleBadge").textContent=PROFILE.role==="owner"?"KURUCU":"ADMIN";
 $("roleBadge").className=PROFILE.role==="owner"?"badge on":"badge admin";
 $("adminSec").style.display="block";$("miAdmin").style.display="flex";$("miUsers").style.display="flex";
 if(PROFILE.role==="owner"&&$("miVisitors"))$("miVisitors").style.display="flex";
 dgResumePendingView();
}

async function startShell(){
 const requestedView=dgLastView();
 const initialView=dgResolveRestorableView(requestedView);
 if(requestedView&&initialView!==requestedView&&["admin","users","visitors"].includes(requestedView)&&!PROFILE)DG_PENDING_VIEW_RESTORE=requestedView;
 window.DG_STARTUP_SCREEN?.dashboard({view:initialView,setView:view=>{DG_CUR_VIEW=view;}});
$("landing").style.display="none";$("shell").style.display="block";
 dgApplyShellProfile();
 if(PROFILE){$("whoami").textContent=PROFILE.full_name;
  if(PROFILE.role==="admin"||PROFILE.role==="owner"){$("roleBadge").style.display="inline";$("roleBadge").textContent=PROFILE.role==="owner"?"KURUCU":"ADMIN";$("roleBadge").className=PROFILE.role==="owner"?"badge on":"badge admin";$("adminSec").style.display="block";$("miAdmin").style.display="flex";$("miUsers").style.display="flex";
   /* 0038: Ziyaretçi & Canlı sekmesi YALNIZ KURUCUYA açıktır (kullanıcı isteği). */
   if(PROFILE.role==="owner"&&$("miVisitors"))$("miVisitors").style.display="flex";}}
 /* 0036 (T4): canlı varlık kanalını aç (Realtime yoksa sessiz). */
 if(typeof dgPresenceStart==="function"){try{dgPresenceStart();}catch(e){}}
 /* kaydırma konumunu sekme bazında hatırla */
 const mainEl=$("main");
 if(mainEl&&!window._dgScrollHooked){window._dgScrollHooked=true;
  mainEl.addEventListener("scroll",()=>{try{localStorage.setItem("dg_scroll_"+DG_CUR_VIEW,String(mainEl.scrollTop));}catch(e){}},{passive:true});}
 /* 0041: asıl kayan konteyner WINDOW (bkz. constants.js dgScrollKeep notu) —
  * "kaldığın yerden devam" belleği window.scrollY'yi de kaydeder (120 ms throttle). */
 if(!window._dgScrollWinHooked){window._dgScrollWinHooked=true;
  let _swt=null;
  window.addEventListener("scroll",()=>{if(_swt)return;_swt=setTimeout(()=>{_swt=null;
   try{localStorage.setItem("dg_scrollw_"+DG_CUR_VIEW,String(window.scrollY||0));}catch(e){}},120);},{passive:true});}
if(window.DG_SHELL_VIEW_DATA){
 const startup=window.DG_SHELL_VIEW_DATA.create({loadProjects,loadWaypoints,loadDashboard:loadDash,loadRecords,loadWorld,loadMyRequests,loadRequestOptions});
 window._dgShellViewData=startup;
 await startup.start();
}else{
 await Promise.allSettled([loadProjects(),loadWaypoints()]);
 loadDash();loadRecords();loadWorld();loadMyRequests();loadRequestOptions();
}
 /* Resume the selected module through normal navigation hooks after initial data. */
 if(initialView!=="dash")go(initialView);
 /* Yöneticiyse yan menüdeki 🔐 Ölçüm Yönetimi rozeti baştan güncel olsun
  * (onay bekleyen sayısı). Sekmeyi açmadan da "iş var" görünsün. */
 if(PROFILE&&(PROFILE.role==="admin"||PROFILE.role==="owner")&&typeof dgRefreshPendingBadge==="function")dgRefreshPendingBadge();
autoFillPointId();
}

let DG_CUR_VIEW="dash";
let DG_PENDING_VIEW_RESTORE="";
function dgResolveRestorableView(view){
 const allowed=["dash","measure","nav","map","projects","records","export","world","admin","users","visitors"];
 if(!allowed.includes(view)||!$("v-"+view))return"dash";
 if(["admin","users","visitors"].includes(view)){
  if(!PROFILE)return"dash";
  if(PROFILE.role!=="admin"&&PROFILE.role!=="owner")return"dash";
  if(view==="visitors"&&PROFILE.role!=="owner")return"dash";
 }
 return view;
}
function dgResumePendingView(){
 if(!DG_PENDING_VIEW_RESTORE)return;
 const view=DG_PENDING_VIEW_RESTORE;DG_PENDING_VIEW_RESTORE="";
 if(dgResolveRestorableView(view)===view)go(view);
}
/* KALDIĞIN YERDEN DEVAM (2026-09-27 · kullanıcı isteği): sayfa yenilenince
 * son açık sekme ve o sekmedeki kaydırma konumu geri gelir. localStorage
 * yerine sessionStorage DEĞİL: yenileme dışında tarayıcıyı kapat-aç da
 * kaldığı yeri bulsun istendi. Yazma/okuma hep try/catch (gizli modda
 * storage atabilir). */
function dgSaveView(v){try{localStorage.setItem("dg_last_view",v);}catch(e){}}
function dgLastView(){try{return localStorage.getItem("dg_last_view")||"";}catch(e){return "";}}
// The waypoint map must frame the selected project's actual park, including
// projects with no imported points. Read only that park's public geometry.
function dgFocusSelectedWaypointPark(){
 const viewport=window.DG_WAYPOINT_MAP_VIEWPORT,select=$("nProject");
 if(!viewport?.autoProject||!navMap||!select)return;
 const projectId=Number(select.value);
 const project=(typeof PROJ_LIST!=="undefined"?PROJ_LIST:[]).find(row=>Number(row.id)===projectId);
 if(!project)return;
 void viewport.autoProject({
  map:navMap,panel:$("wpMapPanel"),projectId,parkId:Number(project.park_id||project.parks?.id),
  waypoints:typeof WP!=="undefined"?WP:[],
  isSelected:id=>Number($("nProject")?.value)===id,
  readPark:parkId=>window.DG_FETCH_MEASUREMENT_PARK.fetch({client:sb,id:parkId})
 });
}
function go(v){
 if(window.DG_SHELL_NAVIGATION_CONTROLLER&&window.DG_SHELL_VIEW_EFFECTS)return window.DG_SHELL_NAVIGATION_CONTROLLER.activate(v,{
  document,window,element:$,schedule:(fn,delay)=>setTimeout(fn,delay),initMaps:()=>{if(typeof initMaps==="function")initMaps();},setView:value=>{DG_CUR_VIEW=value;},saveView:dgSaveView,presenceView:typeof dgPresenceView==="function"?dgPresenceView:null,setScrollSwitching:value=>{DG_SCROLL_SWITCHING=value;},stopVisitorTick:typeof dgVisTickStop==="function"?dgVisTickStop:null,presencePing:typeof dgPresencePing==="function"?dgPresencePing:null,
  readScroll:key=>{try{return localStorage.getItem(key)||"0";}catch(error){return"0";}},
  runEffects:view=>window.DG_SHELL_VIEW_EFFECTS.run(view,{schedule:(fn,delay)=>setTimeout(fn,delay),getDataLoader:()=>window._dgShellViewData,loadWaypoints:()=>loadWaypoints(),loadDash:()=>loadDash(),refreshParkGate:()=>{if(typeof dgParkGate==="function")dgParkGate(true);},scheduleLiveShare:()=>{if(typeof dgLiveShareJoinCurrent==="function")setTimeout(()=>{try{dgLiveShareJoinCurrent();}catch(error){}},400);},refreshMap:()=>{map&&map.invalidateSize();if(!liveLoaded||DG_LIVE_DIRTY)loadLiveMap();},refreshNavigation:()=>{navMap&&navMap.invalidateSize();dgFocusSelectedWaypointPark();},refreshWorld:()=>worldMap&&worldMap.invalidateSize(),loadAdmin:()=>loadAdmin(),loadInvites:()=>{if(typeof dgInvitesLoadMine==="function")dgInvitesLoadMine();},loadCollaborators:()=>{if(typeof dgCollabLoad==="function")dgCollabLoad();},loadUsers:()=>loadUsers(),loadVisitors:()=>{try{if(typeof loadVisitors==="function")loadVisitors();}catch(error){}},loadMyRequests:()=>loadMyRequests(),loadRequestOptions:()=>loadRequestOptions()})
 });
 if(["map","nav","world"].includes(v)&&typeof initMaps==="function")initMaps();
 DG_CUR_VIEW=v;dgSaveView(v);
 if(typeof dgPresenceView==="function"){try{dgPresenceView(v);}catch(e){}}
 /* 0040: sekme geçişi sırasında kaydırma koruması devre dışı (eski sekmenin
  * konumu yeniye taşınmasın); 500 ms sonra normale döner. Ziyaretçi sekmesinin
  * otomatik tiki yalnız o sekmede çalışır. */
 DG_SCROLL_SWITCHING=true;setTimeout(()=>{DG_SCROLL_SWITCHING=false;},500);
 if(v!=="visitors"&&typeof dgVisTickStop==="function"){try{dgVisTickStop();}catch(e){}}
 /* 0036: presence — "ne yapıyor" bilgisi tazelenir (geçici, DB'ye yazılmaz). */
 if(typeof dgPresencePing==="function"){try{dgPresencePing(v);}catch(e){}}
 document.querySelectorAll(".view").forEach(x=>x.classList.remove("on"));
 $("v-"+v).classList.add("on");
 document.querySelectorAll("#side .item").forEach(i=>i.classList.remove("on"));
 const items=document.querySelectorAll("#side .item");
 const idx={dash:0,measure:1,nav:2,map:3,projects:4,records:5,export:6,world:7,admin:8,users:9,visitors:10};
if(items[idx[v]])items[idx[v]].classList.add("on");
if(v==="dash"){if(window._dgShellViewData)window._dgShellViewData.load(v);else loadWaypoints().then(()=>loadDash());}
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
 if(v==="nav")setTimeout(()=>{navMap&&navMap.invalidateSize();dgFocusSelectedWaypointPark();},150),window._dgShellViewData?window._dgShellViewData.load(v):loadWaypoints();
 if(v==="records"&&window._dgShellViewData)window._dgShellViewData.load(v);
 if(v==="world"&&window._dgShellViewData)window._dgShellViewData.load(v);
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
 /* 0038: kurucu sekmesi — canlı liste + harita + etkinlik akışı */
 if(v==="visitors"){setTimeout(()=>{try{if(typeof loadVisitors==="function")loadVisitors();}catch(e){}},120);}
if(v==="export"){if(window._dgShellViewData)window._dgShellViewData.load(v);else{loadMyRequests();loadRequestOptions();}}
 /* kaydırma konumunu geri getir (sekme içeriği çizildikten sonra) */
 setTimeout(()=>{const m=$("main");if(!m)return;
  const sc=parseInt((()=>{try{return localStorage.getItem("dg_scroll_"+v)||"0";}catch(e){return "0";}})(),10);
  if(sc>0)m.scrollTop=sc;
  const scw=parseInt((()=>{try{return localStorage.getItem("dg_scrollw_"+v)||"0";}catch(e){return "0";}})(),10);
  if(scw>0)window.scrollTo(0,scw);},180);
}

document.addEventListener("change",event=>{
 if(event.target?.id==="nProject")dgFocusSelectedWaypointPark();
});
document.addEventListener("toggle",event=>{
 if(event.target?.id!=="wpMapPanel"||!event.target.open)return;
 const apply=()=>window.DG_WAYPOINT_MAP_VIEWPORT?.applyProject?.({map:navMap,panel:event.target,projectId:Number($("nProject")?.value)});
 if(typeof window.requestAnimationFrame==="function")window.requestAnimationFrame(apply);else setTimeout(apply,0);
},true);

boot().catch(error=>{window.DG_STARTUP_SCREEN?.finish();initLanding();console.error("DENDROGEO · Giriş başlatılamadı:",error);toast(dgCf("Giriş başlatılamadı. Lütfen tekrar deneyin."),"err");});

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
