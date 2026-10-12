"use strict";
/* DendroGeo · services/report-publish.js — SİTE İÇİNDEN BİLİMSEL RAPOR YAYINI
 *
 * KULLANICI İSTEĞİ (2026-09-27): "raporu site üstünden yayınlayacağım" —
 * GitHub Actions arayüzüne gitmeden, uygulama içinden tek düğmeyle DGR
 * kimlikli bilimsel rapor yayınlanır ve kalıcı bağlantısı yine burada görünür.
 *
 * AKIŞ
 *   1) 📄 Yayınla → report_requests'e 'Beklemede' satırı (0008_report_publish.sql).
 *   2) rapor-yayin.yml (5 dk'da bir) → scripts/publish-queue.mjs → make-report.mjs
 *      raporu üretir, rapor/DGR-…/ altına commit'ler, sonucu
 *      rapor/yayin-kuyrugu.json'a yazar.
 *   3) Bu modül o günlüğü okur: durum rozeti, kalıcı bağlantı, 🔗 Aç ve
 *      📤 Paylaş düğmeleri kartta belirir. Bekleyen istek varken 25 sn'de bir
 *      sessizce tazelenir → sayfayı yenilemeye gerek kalmaz.
 *
 * GÜVENLİK / DÜRÜSTLÜK
 *   · Yönetici kartı (v-admin): istek yazma dgPubAdmin() kapısıyla korunur.
 *   · KULLANICI TARAFI (0009_user_report_publish.sql): parkı için projesi olan
 *     kullanıcı isteği KENDİSİ açar — sunucu kilitleri: mülkiyet (kendi
 *     projesinin parkı), kendi onaylı ölçümü, 24 saatte 3 istek kotası,
 *     requested_by = auth.uid(). İstemci kapısı yalnız UX'tir; yetki RLS +
 *     tg_report_request_gate'te (iki katman, 0006/0008 deseni).
 *   · Günlük dosyası Pages'te herkese açıktır. Bu yüzden bağlantı günlüğün
 *     yazdığı metinden DEĞİL, biçimi doğrulanmış rapor kimliğinden kurulur
 *     (DG_PUB_ID): bozulmuş/oynanmış bir günlük uygulama içine dış bağlantı
 *     sokamaz.
 *   · Sayılar burada YENİDEN HESAPLANMAZ; kart yalnız kimlik + durum gösterir.
 *     Rapordaki tüm değerler make-report.mjs'in canlı veri snapshot'ından gelir
 *     (park karşılaştırma satırındaki karbon yalnız seçim yardımıdır).
 *
 * GÖRÜNÜM: yönetici yayın merkezi ortak tema tokenları ve mevcut buton/rozet
 * aileleriyle düzenlenir. Özet, kuyruk, DOI ve son hata önde; ayrıntılı günlük
 * ile değişmezlik kuralları isteğe bağlı açılır. Kart yalnız v-admin içindedir.
 */

/* Modül durumu (üst düzey let: module-registry global ad çakışmasını kilitler). */
let DG_PUB_STATE={parks:[],requests:[],retractions:[],queue:null,queueAt:0,error:"",loading:false,pollTimer:0,pollCount:0};

const DG_PUB_QUEUE_URL="/rapor/yayin-kuyrugu.json";
const DG_PUB_ORIGIN="https://dendrogeo.org";
/* DGR-YYYY-NNNN: yayın kimliğinin TEK kabul edilen biçimi. */
const DG_PUB_ID=/^DGR-\d{4}-\d{4}$/;
const DG_PUB_DOI=/^10\.5281\/zenodo\.\d+$/;
const DG_PUB_QUEUE_STATE=window.DG_REPORT_PUBLICATION_REQUEST_APPLICATION.createReportPublicationQueueState({
 isReportId:value=>DG_PUB_ID.test(String(value||""))
});
const DG_PUB_POLL_MS=25000;      /* bekleyen istek varken tazeleme aralığı */
const DG_PUB_POLL_MAX=80;        /* ~33 dk; sonra elle 🔄 Yenile */

function dgPubAdmin(){return !!(typeof PROFILE!=="undefined"&&PROFILE&&(PROFILE.role==="admin"||PROFILE.role==="owner"));}
function dgPubUrl(reportId){return window.DG_REPORT_PUBLICATION_LINK.url(reportId,DG_PUB_ORIGIN);}

/* ---------- okuma ---------- */
async function dgPubFetchQueue(){
 /* ?_=… : her okuma ağdan güncel kuyruğu ister; bozuk/erişilemeyen günlük boş kalır. */
 return window.DG_REPORT_PUBLICATION_LOG_STORE.load({fetch,url:DG_PUB_QUEUE_URL,now:Date.now});
}

async function dgPubFetchRequests(){
 const{data,error}=await window.DG_REPORT_PUBLICATION_REQUEST_STORE.load(sb);
 if(error){
  /* 42P01 = tablo yok → 0008 uygulanmamış. Sessiz kalmak yerine kartta
   * yapılacak iş yazılır (DG_PARK_SCHEMA_OK deseniyle aynı yaklaşım). */
  DG_PUB_STATE.error=(error.code==="42P01"||/report_requests/i.test(error.message||""))
   ? "SCHEMA"
   : ("İstekler okunamadı: "+(error.message||error.code||"bilinmeyen hata"));
  return [];
 }
 DG_PUB_STATE.error="";
 return data||[];
}

async function dgPubFetchParks(){
 return window.DG_REPORT_PARK_COMPARISON_STORE.load(sb);
}

/* Geri çekme istekleri (0010): tablo yoksa (0010 uygulanmamış) SESSİZCE boş
 * liste — yayın akışı bundan etkilenmez, 🗑 isteği sunucuda zaten reddedilir. */
async function dgPubFetchRetractions(){
 return window.DG_REPORT_RETRACTION_STORE.load(sb);
}

/* ---------- durum birleştirme: istek (DB) + sonuç (repo günlüğü) ---------- */
function dgPubEntryFor(reqId){
 return DG_PUB_QUEUE_STATE.entryFor(DG_PUB_STATE.queue,reqId);
}
/* GERİ ÇEKME FİLTRESİ (0010): günlükte 'Geri çekildi' kaydı olan rapor artık
 * "yayınlandı" sayılmaz — bağlantısı kurulmaz, listeden düşer, yerine durum
 * rozeti geçer. Kimlik biçimi burada da DOĞRULANIR (dgPubUrl tek kapı). */
function dgPubRetractedIds(queue){
 return DG_PUB_QUEUE_STATE.retractedIds(queue);
}
function dgPubRetractDone(queue,retId){
 return DG_PUB_QUEUE_STATE.retractionDone(queue,retId);
}
function dgPubRetractedInPark(queue,parkId){
 return DG_PUB_QUEUE_STATE.retractedInPark(queue,parkId);
}
function dgPubPublishedByPark(){
 return DG_PUB_QUEUE_STATE.publishedByPark(DG_PUB_STATE.queue);
}
function dgPubStatus(req){
 return DG_PUB_QUEUE_STATE.status(req,DG_PUB_STATE.queue);
}

/* ---------- çizim ---------- */
/* 0040: kaydırma koruma sarmalı. */
function dgPubRender(){const _y=(typeof dgScrollKeep==="function"?dgScrollKeep():null);try{return dgPubRender__scroll.apply(this,arguments);}finally{if(typeof dgScrollRestore==="function")dgScrollRestore(_y);}}
/* Retry policy: `return !prev||prev.status==="Başarısız"`; queue count: `return !e||e.status==="Başarısız"`.
 * Both projections live in resolve-publication-park-status.js / summarize-publication-queue.js. */
function dgPubRender__scroll(){
 const box=$("dgPubBox");if(!box)return;
 const st=DG_PUB_STATE;
 const pubByPark=dgPubPublishedByPark();
 const clock=$("dgPubClock");
 if(clock)clock.textContent=st.queueAt?(dgCf("son kontrol")+" "+new Date(st.queueAt).toLocaleTimeString("tr-TR")):"—";
 const card=window.DG_RENDER_PUBLICATION_ADMIN_CARD;
 if(st.error==="SCHEMA"){box.innerHTML=card.schemaWarning();return;}
 const rows=st.parks.map(park=>{
  const view=window.DG_RESOLVE_PUBLICATION_PARK_STATUS.resolve(park,st,{
   entryFor:dgPubEntryFor,
   publishedByPark:pubByPark,
   retractionDone:id=>dgPubRetractDone(st.queue,id),
   retractedInPark:id=>dgPubRetractedInPark(st.queue,id),
   status:request=>dgPubStatus(request),
   escape:esc,
   translate:dgCf,
   isDoi:value=>DG_PUB_DOI.test(String(value||"")),
   isReportId:value=>DG_PUB_ID.test(String(value||""))
  });
  return window.DG_RENDER_PUBLICATION_PARK_ROW.render(park,view,{
   url:dgPubUrl,escape:esc,translate:dgCf,
   isDoi:value=>DG_PUB_DOI.test(String(value||"")),
   area:value=>typeof dgFmtHa==="function"?dgFmtHa(value):"—"
  });
 }).join("");
 const history=window.DG_RENDER_PUBLICATION_HISTORY.render(st.queue,{
  retractedIds:dgPubRetractedIds,
  isReportId:value=>DG_PUB_ID.test(String(value||"")),
  url:dgPubUrl,escape:esc,translate:dgCf
 });
 const summary=window.DG_SUMMARIZE_PUBLICATION_QUEUE.summarize(st,pubByPark,{
  entryFor:dgPubEntryFor,
  isDoi:value=>DG_PUB_DOI.test(String(value||"")),
  escape:esc
 });
 box.innerHTML=card.render({summary,rows,history,error:st.error,queueMissing:st.queue===null,escape:esc,translate:dgCf});
}
/* ---------- yazma (ortak çekirdek: yönetici kartı + kullanıcı paneli) ---------- */
/* RLS-safe insert (trackVisit ile aynı desen): "Prefer: return=minimal" —
 * return=representation olsaydı RETURNING satırı politikaya takılıp istek
 * sessizce ölebilirdi. Adapter `"Prefer":"return=minimal"` ve `await sb.auth.getSession()` desenini korur. */
async function dgPubInsertRequest(parkId,lulc,note){
 return window.DG_REPORT_PUBLICATION_REQUEST_INSERT_STORE.insert(sb,{
  fetch,supabaseUrl:SB_URL,anonKey:SB_KEY,parkId,includeLandCover:lulc,
  userId:(typeof USER!=="undefined"&&USER&&USER.id)||null,note
 });
}

/* Hata metni eşleme: PostgREST, RLS reddini ve tetikleyici hatalarını gövdede
 * taşır (REPORT_QUOTA / REPORT_NOT_YOUR_PARK / REPORT_NO_OWN_DATA / …). */
function dgPubInsertError(r){
 return window.DG_PUBLICATION_REQUEST_ERROR.message(r,dgCf);
}

async function dgPublishReport(parkId){
 if(typeof dgPresenceAct==="function"){try{dgPresenceAct("publish","park #"+parkId);}catch(e){}}
 if(!dgPubAdmin())return toast("Rapor yayını yalnız yönetici içindir.","err","📄");
 const lulc=$("dgPubLulc")?$("dgPubLulc").checked!==false:true;
 return window.DG_REQUEST_PUBLICATION.execute(parkId,lulc,{
  collect:dgReportCollectRequest,
  onSuccess:async()=>{
   toast("📄 Yayın isteği kuyruğa alındı — rapor birkaç dakika içinde burada bağlanacak.","ok","📄");
   DG_PUB_STATE.pollCount=0;
   await dgLoadPublishQueue();
   dgPubSchedulePoll();
  },
  onFailure:r=>{
   const msg=dgPubInsertError(r);
   if(/0008_report_publish/.test(msg))DG_PUB_STATE.error="SCHEMA";
   toast(msg,"err","📄");
   dgPubRender();
  }
 });
}

async function dgPublishCancel(id){
 return window.DG_CANCEL_PUBLICATION_REQUEST.execute({
  canCancel:dgPubAdmin,
  onDenied:()=>toast("Yalnız yönetici iptal edebilir.","err","📄"),
  confirm:()=>confirm(dgCf("Bekleyen yayın isteği iptal edilsin mi?")),
  cancel:()=>window.DG_REPORT_PUBLICATION_CANCEL_STORE.cancel(sb,id,new Date().toISOString()),
  onFailure:error=>toast(dgCf("İptal edilemedi: ")+esc(error.message),"err","📄"),
  onSuccess:async()=>{toast("İstek iptal edildi.","ok","📄");await dgLoadPublishQueue();}
 });
}

/* ---------- GERİ ÇEKME (0010): yayımlanmış rapor yayından kaldırılır ----------
 * Bilimsel teamül: SESSİZ SİLME YOK — istek kuyruğa yazılır, Actions işi
 * veri dosyalarını kaldırır, adresinde gerekçeli bildirim bırakır, günlük
 * 'Geri çekildi' kaydı alır. DGR kimliği yeniden kullanılmaz.
 * YETKİ SUNUCUDA: yönetici herhangi bir raporu; kullanıcı YALNIZ kendi
 * projesinin parkının raporunu geri çekebilir (RLS + tg_report_retraction_gate).
 * report_id ↔ park_id eşleşmesini Actions günlükle ayrıca doğrular. */
async function dgRetractInsert(reportId,parkId,reason){
 return window.DG_REPORT_RETRACTION_INSERT_STORE.insert(sb,{
  fetch,supabaseUrl:SB_URL,anonKey:SB_KEY,reportId,parkId,reason,
  userId:(typeof USER!=="undefined"&&USER&&USER.id)||null
 });
}

function dgRetractError(r){
 return window.DG_RETRACTION_REQUEST_ERROR.message(r);
}

async function dgReportRetract(reportId,parkId){
 return window.DG_REQUEST_REPORT_RETRACTION.execute(reportId,parkId,{
  isValidReportId:value=>DG_PUB_ID.test(String(value||"")),
  isAuthenticated:()=>typeof USER!=="undefined"&&!!USER,
  onInvalidReport:()=>toast("Rapor kimliği geçersiz.","err","🗑"),
  onUnauthenticated:()=>toast("Önce giriş yap.","err","🗑"),
  confirm:id=>confirm(id+" yayından geri çekilsin mi?\n\nRaporun veri dosyaları kaldırılır; adresinde gerekçeli geri çekme bildirimi kalır. DGR kimliği yeniden kullanılmaz; işlem günlüğe ve git geçmişine yazılır."),
  askReason:()=>window.prompt("Gerekçe (bildirim sayfasında ve günlükte yayımlanır; boş bırakılabilir):","yanlışlıkla yayınlandı"),
  insert:dgRetractInsert,
  onSuccess:async()=>{
   toast("🗑 Geri çekme isteği kuyruğa alındı — rapor birkaç dakika içinde yayından kalkar.","ok","🗑");
   window.DG_RESET_PUBLICATION_POLLING.reset(DG_PUB_STATE,DG_USER_PUB);
   return window.DG_REFRESH_AFTER_REPORT_RETRACTION.execute(DG_USER_PUB,{
    hasAdminView:()=>$('dgPubBox'),
    refreshAdmin:()=>dgLoadPublishQueue({silent:true}),
    refreshUser:dgUserPubRefresh
   });
  },
  onFailure:r=>toast(dgRetractError(r),"err","🗑")
 });
}

/* ---------- KULLANICI TARAFI (0009): 📁 Projeler → 📄 Park Raporu ----------
 * Parkı için projesi olan kullanıcı rapor isteğini KENDİSİ açar; sonuç aynı
 * kuyruktan döner (rapor-yayin.yml → yayin-kuyrugu.json → kalıcı bağlantı).
 * Yetki kararı SUNUCUDA (RLS + tg_report_request_gate): mülkiyet, kendi
 * onaylı ölçümü, 24 saatte 3 istek, requested_by = auth.uid(). İstemci
 * kapıları yalnız UX'tir — yetki sınırı DEĞİL. Yeni CSS yok: yönetici
 * kartıyla aynı card/shead/badge/btn/alert/dg-tree-meta/mono aileleri.
 * Panel durumu yönetici kartından AYRI tutulur (DG_USER_PUB): iki arayüz
 * birbirinin verisini ezmez. */
let DG_USER_PUB={projectId:0,parkId:0,parkName:"",requests:[],retracts:[],queue:null,ownApproved:null,error:"",timer:0,polls:0};

/* Saf okuma yardımcıları (günlük dosyası parametrik: yönetici kartı kendi
 * durumunu, kullanıcı paneli kendi durumunu verir). Kimlik biçimi DOĞRULANMADAN
 * hiçbir girdi "yayınlandı" sayılmaz — oynanmış günlük dış bağlantı sokamaz. */
function dgPubEntryIn(queue,reqId){
 if((queue?.archived_request_ids||[]).includes(String(reqId)))return {request_id:reqId,status:"Test arşivi"};
 const es=(queue&&queue.entries)||[];
 for(let i=es.length-1;i>=0;i--)if(String(es[i].request_id)===String(reqId))return es[i];
 return null;
}
function dgPubPublishedInPark(queue,parkId){
 const ret=dgPubRetractedIds(queue);
 const es=(queue&&queue.entries)||[];
 for(let i=es.length-1;i>=0;i--){
  const e=es[i];
  if(e.status==="Yayınlandı"&&String(e.park_id)===String(parkId)&&DG_PUB_ID.test(String(e.report_id||""))&&!ret[String(e.report_id)])return e;
 }
 return null;
}

async function dgUserPubOpen(projectId){
 const list=(typeof PROJ_LIST!=="undefined"&&Array.isArray(PROJ_LIST))?PROJ_LIST:[];
 return window.DG_OPEN_USER_PUBLICATION_PANEL.execute(projectId,{
  getBox:()=>$('dgUserPubBox'),
  isAuthenticated:()=>typeof USER!=="undefined"&&!!USER,
  findProject:id=>list.find(x=>Number(x.id)===Number(id)),
  onUnauthenticated:()=>toast("Önce giriş yap.","err","📄"),
  onMissingProject:()=>toast("Proje bulunamadı — listeden yeniden dene.","err","📄"),
  onUnlinkedProject:()=>toast("Bu proje bir parka bağlı değil — rapor park kimliği ister.","err","🌳"),
  stopPolling:()=>{if(DG_USER_PUB.timer){clearInterval(DG_USER_PUB.timer);DG_USER_PUB.timer=0;}},
  selectProject:p=>{
   DG_USER_PUB.projectId=Number(p.id);
   DG_USER_PUB.parkId=Number(p.park_id);
   DG_USER_PUB.parkName=(p.parks&&p.parks.name)||p.park_name||("park #"+p.park_id);
   DG_USER_PUB.requests=[];DG_USER_PUB.retracts=[];DG_USER_PUB.error="";DG_USER_PUB.ownApproved=null;DG_USER_PUB.polls=0;
  },
  refresh:dgUserPubRefresh
 });
}

async function dgUserPubRefresh(){
 return window.DG_LOAD_USER_PUBLICATION.execute(DG_USER_PUB,{
  loadRequests:parkId=>window.DG_USER_PUBLICATION_REQUEST_STORE.load(sb,parkId),
  requestError:(error,transport)=>transport
   ?("İstekler okunamadı: "+((error&&error.message)||error))
   :((error.code==="42P01"||/report_requests/i.test(error.message||""))
    ?"SCHEMA"
    :("İstekler okunamadı: "+(error.message||error.code||"bilinmeyen hata"))),
  loadQueue:dgPubFetchQueue,
  loadOwnApproved:dgUserOwnApproved,
  loadRetractions:dgUserFetchRetractions,
  render:dgUserPubRender,
  schedulePoll:dgUserPubSchedulePoll
 });
}

/* Bu projedeki kendi onaylı ölçüm sayısı (yalnız BİLGİ: yayın kararını
 * sunucu verir — aynı parktaki başka projenin onaylı verisi de yeter). */
async function dgUserOwnApproved(){
 if(typeof USER==="undefined"||!USER||!DG_USER_PUB.projectId)return null;
 try{return await window.DG_OWN_APPROVED_MEASUREMENTS_STORE.count(sb,DG_USER_PUB.projectId,USER.id);}
 catch(e){return null;}
}

/* Bu parkın geri çekme istekleri (0010): tablo yoksa sessizce boş — panel
 * yayın durumunu göstermeye devam eder, 🗑 sunucuda zaten reddedilir. */
async function dgUserFetchRetractions(){
 if(!DG_USER_PUB.parkId)return[];
 return window.DG_USER_RETRACTION_STORE.load(sb,DG_USER_PUB.parkId);
}

/* Panel translations still flow through dgCf("yayın işi 5 dakikada bir çalışır") via the view module's translate port. */
/* Queue-history translation still routes dgCf("geri çekildi") through render-publication-history.js. */
function dgUserPubRender(){
 const box=$("dgUserPubBox");if(!box)return;
 const st=DG_USER_PUB;
 const card=window.DG_RENDER_USER_PUBLICATION_CARD;
 const close="<button class=\"btn sm ghost\" onclick=\"dgUserPubClose()\" title=\"Paneli kapat\">✖ Kapat</button>";
 if(st.error==="SCHEMA"){box.innerHTML=card.schemaWarning(close);return;}
 const mine=(typeof USER!=="undefined"&&USER&&USER.id)||"";
 const view=window.DG_RESOLVE_USER_PUBLICATION_VIEW.resolve(st,mine,{
  entryFor:dgPubEntryIn,
  publishedInPark:dgPubPublishedInPark,
  retractionDone:(queue,id)=>dgPubRetractDone(queue,id),
  retractedInPark:(queue,parkId)=>dgPubRetractedInPark(queue,parkId),
  isReportId:value=>DG_PUB_ID.test(String(value||"")),
  url:dgPubUrl,translate:dgCf,now:Date.now
 });
 const header=window.DG_RENDER_USER_PUBLICATION_HEADER.render(st,view,close,esc);
 const controls=window.DG_RENDER_USER_PUBLICATION_CONTROLS.render(view,st,{escape:esc});
 const notices=window.DG_RENDER_USER_PUBLICATION_NOTICES.render(st,esc);
 box.innerHTML=card.render(st,st.error,header,controls,notices,esc);
}
async function dgUserPublish(parkId){
 if(typeof USER==="undefined"||!USER)return toast("Önce giriş yap.","err","📄");
 const lulc=$("dgUserPubLulc")?$("dgUserPubLulc").checked!==false:true;
 return window.DG_REQUEST_PUBLICATION.execute(parkId,lulc,{
  collect:dgReportCollectRequest,
  onSuccess:async()=>{
   toast("📄 Yayın isteği kuyruğa alındı — rapor birkaç dakika içinde burada bağlanacak.","ok","📄");
   DG_USER_PUB.polls=0;
   await dgUserPubRefresh();
  },
  onFailure:r=>{
   const msg=dgPubInsertError(r);
   if(/0008_report_publish/.test(msg))DG_USER_PUB.error="SCHEMA";
   toast(msg,"err","📄");
   dgUserPubRender();
  }
 });
}

async function dgUserCancel(id){
 const mine=(typeof USER!=="undefined"&&USER&&USER.id)||"";
 const row=DG_USER_PUB.requests.find(r=>String(r.id)===String(id));
 const own=!!(row&&String(row.requested_by||"")===String(mine));
 return window.DG_CANCEL_PUBLICATION_REQUEST.execute({
  canCancel:()=>own||dgPubAdmin(),
  onDenied:()=>toast("Yalnız kendi bekleyen isteğini iptal edebilirsin.","err","📄"),
  confirm:()=>confirm(dgCf("Bekleyen yayın isteği iptal edilsin mi?")),
  cancel:()=>window.DG_REPORT_PUBLICATION_CANCEL_STORE.cancel(sb,id,new Date().toISOString()),
  onFailure:error=>toast(dgCf("İptal edilemedi: ")+esc(error.message),"err","📄"),
  onSuccess:async()=>{toast("İstek iptal edildi.","ok","📄");await dgUserPubRefresh();}
 });
}

/* Kendi bekleyen isteği varken ve panel görünürken 25 sn'de bir sessiz tazeleme
 * (yönetici kartındaki dgPubSchedulePoll ile aynı desen ve sınırlar). */
function dgUserPubSchedulePoll(){
 return window.DG_SCHEDULE_USER_PUBLICATION_POLL.execute(DG_USER_PUB,{
  clearTimer:clearInterval,
  userId:()=>typeof USER!=="undefined"&&USER&&USER.id,
  entryFor:dgPubEntryIn,
  retractionDone:dgPubRetractDone,
  maxPolls:DG_PUB_POLL_MAX,
  setInterval,
  intervalMs:DG_PUB_POLL_MS,
  isProjectsTabActive:()=>{const tab=$("v-projects");return !tab||tab.classList.contains("on");},
  isDocumentHidden:()=>document.hidden,
  isPanelVisible:()=>{const box=$("dgUserPubBox");return !!box&&box.style.display!=="none";},
  refresh:dgUserPubRefresh
 });
}

function dgUserPubClose(){
 return window.DG_CLOSE_USER_PUBLICATION_PANEL.execute(DG_USER_PUB,{clearTimer:clearInterval,getBox:()=>$('dgUserPubBox')});
}

/* loadProjects() her çizimde çağırır: paneli açık proje listeden silindiyse
 * (proje silindi) panel kapanır — hayalet durum gösterilmez. */
function dgUserPubSync(list){
 return window.DG_SYNC_USER_PUBLICATION_PANEL.execute(DG_USER_PUB,list,dgUserPubClose);
}

/* ---------- paylaş ---------- */
async function dgReportShare(reportId,parkName){
 return window.DG_SHARE_REPORT_LINK.share(reportId,{
  parkName,
  url:dgPubUrl,
  share:navigator.share?navigator.share.bind(navigator):null,
  copy:url=>navigator.clipboard.writeText(url),
  copied:url=>toast(dgCf("🔗 Bağlantı kopyalandı: ")+url,"ok","📄"),
  prompt:url=>window.prompt("Bağlantıyı kopyalayın (Ctrl+C):",url),
  invalidLink:()=>toast("Bağlantı kurulamadı: rapor kimliği geçersiz.","err","📄")
 });
}

function dgReportOpen(reportId){
 return window.DG_SHARE_REPORT_LINK.open(reportId,{
  url:dgPubUrl,
  open:url=>window.open(url,"_blank","noopener"),
  invalidLink:()=>toast("Bağlantı kurulamadı: rapor kimliği geçersiz.","err","📄")
 });
}

/* ---------- yükleme + kendiliğinden tazeleme ---------- */
async function dgLoadPublishQueue(opts){
 return window.DG_LOAD_PUBLICATION_QUEUE.execute(DG_PUB_STATE,opts,{
  hasView:()=>!!$("dgPubBox"),
  showLoading:()=>{$("dgPubBox").innerHTML='<div class="dg-tree-meta">⏳ Kuyruk yükleniyor…</div>';},
  loadParks:dgPubFetchParks,
  loadRequests:dgPubFetchRequests,
  loadQueue:dgPubFetchQueue,
  loadRetractions:dgPubFetchRetractions,
  now:Date.now,
  render:dgPubRender,
  schedulePoll:dgPubSchedulePoll
 });
}

/* Bekleyen istek varken ve yönetici sekmesi görünürken 25 sn'de bir sessiz
 * tazeleme → kullanıcı F5'e basmadan bağlantının belirdiğini görür. */
function dgPubSchedulePoll(){
 return window.DG_SCHEDULE_PUBLICATION_QUEUE_POLL.execute(DG_PUB_STATE,{
  clearTimer:clearInterval,
  entryFor:dgPubEntryFor,
  retractionDone:id=>dgPubRetractDone(DG_PUB_STATE.queue,id),
  maxPolls:DG_PUB_POLL_MAX,
  setInterval,
  intervalMs:DG_PUB_POLL_MS,
  isAdminViewActive:()=>{const view=$("v-admin");return !view||view.classList.contains("on");},
  isDocumentHidden:()=>document.hidden,
  refresh:()=>dgLoadPublishQueue({silent:true})
 });
}

window.dgLoadPublishQueue=dgLoadPublishQueue;
window.dgPublishReport=dgPublishReport;
window.dgPublishCancel=dgPublishCancel;
window.dgReportShare=dgReportShare;
window.dgReportOpen=dgReportOpen;
window.dgUserPubOpen=dgUserPubOpen;
window.dgUserPubClose=dgUserPubClose;
window.dgUserPublish=dgUserPublish;
window.dgUserCancel=dgUserCancel;
window.dgUserPubSync=dgUserPubSync;
window.dgReportRetract=dgReportRetract;

