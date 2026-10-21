"use strict";
/* DendroGeo · services/data-requests.js — VERİ TALEP AKIŞI (Faz 6)
 * admin.js'ten birebir taşındı: kullanıcı tarafı talep formu
 * (sendDataRequest/loadMyRequests/loadRequestOptions/req*Changed) ve
 * yönetici tarafı talep kuyruğu (loadRequests/rejectRequest/fulfillRequest).
 * REQ_ROWS/REQ_PROJECTS state'i admin.js (çekirdek) içindedir — çağrı anında
 * global lexical kapsamdan çözülür (admin.js bu dosyadan SONRA yüklenir ama
 * tüm çağrılar boot sonrasında olur). */

/* ============ VERİ TALEBİ (kullanıcı → yönetici) ============ */
let DG_REQUEST_BADGE_READ=null,DG_REQUEST_BADGE_LAST=0,DG_REQUEST_BADGE_EPOCH=0;
async function dgRefreshDataRequestBadge(){
 const ui=window.DG_DATA_REQUEST_PENDING_TABLE_UI;
 const authorized=()=>typeof PROFILE!=="undefined"&&PROFILE&&(PROFILE.role==="admin"||PROFILE.role==="owner");
 if(!authorized()){
  DG_REQUEST_BADGE_EPOCH++;
  ui?.updateBadge(document,0);
  return;
 }
 if(DG_REQUEST_BADGE_READ)return DG_REQUEST_BADGE_READ;
 if(Date.now()-DG_REQUEST_BADGE_LAST<15000)return;
 DG_REQUEST_BADGE_LAST=Date.now();
 const epoch=DG_REQUEST_BADGE_EPOCH,userId=typeof USER!=="undefined"?USER?.id:null;
 DG_REQUEST_BADGE_READ=Promise.resolve().then(async()=>{
  try{
   const{count,error}=await window.DG_ADMIN_PERSISTENCE_STORE.create(()=>sb).countPendingDataRequests();
   if(!error&&epoch===DG_REQUEST_BADGE_EPOCH&&authorized()&&userId===(typeof USER!=="undefined"?USER?.id:null))ui?.updateBadge(document,count||0,typeof dgTfs==="function"?dgTfs:undefined);
  }catch(error){}finally{DG_REQUEST_BADGE_READ=null;}
 });
 return DG_REQUEST_BADGE_READ;
}
window.DG_DATA_REQUEST_PENDING_TABLE_UI?.bindRefresh(dgRefreshDataRequestBadge);
async function sendDataRequest(){
 if(!USER)return;
 const country=$("reqCountry").value.trim()||null;
 const city=$("reqCity").value.trim()||null;
 const project_name=$("reqProject").value.trim()||null;
 const note=$("reqNote").value.trim()||null;
 const m=$("reqMsg");
 return await window.DG_SUBMIT_DATA_REQUEST.execute({
  readPending:()=>window.DG_DATA_REQUEST_SUBMIT_STORE.pending(sb,USER.id),
  findDuplicate:pending=>window.DG_DATA_REQUEST_DUPLICATE.find(pending,{country,city,project_name}),
  onDuplicate:dup=>{
   toast("⚠️ Bu veri talebiniz zaten alındı — yönetici onayı bekleniyor","warn","✉️");
   window.DG_DATA_REQUEST_SUBMISSION_FEEDBACK_UI.duplicate(m,dup.status,{translateFormatted:typeof dgTfs==="function"?dgTfs:null});
  },
  onCheckError:error=>console.log("Dup kontrolü:",error),
  buildBody:()=>({user_id:USER.id,email:PROFILE?.email||USER.email,country,city,project_name,note,status:"Beklemede"}),
  insert:body=>window.DG_DATA_REQUEST_SUBMIT_STORE.insert(sb,body),
  onInsertError:error=>window.DG_DATA_REQUEST_SUBMISSION_FEEDBACK_UI.failure(m,error),
  onSuccess:()=>{
   toast("✓ Talep gönderildi — yönetici yanıtı bekleniyor","ok","✉️");
   window.DG_DATA_REQUEST_SUBMISSION_FEEDBACK_UI.success(m);
   $("reqCountry").value="";$("reqCity").value="";$("reqProject").value="";$("reqNote").value="";
   loadMyRequests();
  }
 });
}

/* 0040: kaydırma koruma sarmalı — yeniden çizimde #main scrollTop korunur. */
async function loadMyRequests(){const _y=(typeof dgScrollKeep==="function"?dgScrollKeep():null);try{return await loadMyRequests__scroll.apply(this,arguments);}finally{if(typeof dgScrollRestore==="function")dgScrollRestore(_y);}}
async function loadMyRequests__scroll(){
 return await window.DG_LOAD_OWN_DATA_REQUESTS.execute(USER,{
  load:userId=>window.DG_MY_DATA_REQUESTS_STORE.load(sb,userId),
  getTarget:()=>$("myRequests"),
  onFailure:el=>window.DG_MY_DATA_REQUESTS_UI.failure(el),
  onEmpty:el=>window.DG_MY_DATA_REQUESTS_UI.clear(el),
  render:(el,data)=>window.DG_MY_DATA_REQUESTS_UI.render(el,data,{escape:esc,actions:{delete:id=>deleteMyRequest(id)}})
 });
}
async function deleteMyRequest(id){
 return await window.DG_DELETE_OWN_DATA_REQUEST_APPLICATION.execute(USER,id,{
  confirm:()=>confirm("Bu veri talebi silinsin mi?"),
  remove:(requestId,userId)=>window.DG_DELETE_OWN_DATA_REQUEST.remove(sb,requestId,userId),
  onFailure:error=>toast("Talep silinemedi: "+(error?.message||"Yetki veya kayıt bulunamadı."),"err","🗑"),
  onSuccess:()=>toast("Talep silindi.","ok","🗑"),
  refresh:()=>loadMyRequests()
 });
}

/* --- Kullanıcı talep formu --- */
async function loadRequestOptions(){
 return await window.DG_LOAD_DATA_REQUEST_OPTIONS.execute({
  load:()=>window.DG_DATA_REQUEST_OPTIONS_STORE.load(sb),
  apply:(rows,projects)=>{REQ_ROWS=rows;REQ_PROJECTS=projects;},
  warn:m=>dgWarnIfTruncated(m.data,5000,"Talep formu seçenekleri",m.count),
  fillCountries:()=>fillSelect($("reqCountry"),listCountries(REQ_ROWS,REQ_PROJECTS)),
  refreshCities:()=>reqCountryChanged()
 });
}

function reqCountryChanged(){
 fillSelect($("reqCity"),listCities(REQ_ROWS,REQ_PROJECTS,$("reqCountry").value));
 reqCityChanged();
}

function reqCityChanged(){
 fillSelect($("reqProject"),listProjects(REQ_PROJECTS,$("reqCountry").value,$("reqCity").value,false));
}

/* ============ YÖNETİCİ: KULLANICI VERİ TALEPLERİ ============ */
/* 0040: kaydırma koruma sarmalı — yeniden çizimde #main scrollTop korunur. */
async function loadRequests(){const _y=(typeof dgScrollKeep==="function"?dgScrollKeep():null);try{return await loadRequests__scroll.apply(this,arguments);}finally{if(typeof dgScrollRestore==="function")dgScrollRestore(_y);}}
async function loadRequests__scroll(){
 return await window.DG_LOAD_DATA_REQUEST_QUEUE.execute({
  load:()=>window.DG_DATA_REQUEST_QUEUE_STORE.load(sb),
  partition:rows=>window.DG_DATA_REQUEST_QUEUE.partition(rows),
  updateCounts:pending=>{DG_REQUEST_BADGE_EPOCH++;window.DG_DATA_REQUEST_PENDING_TABLE_UI.updateCounts(document,pending);},
  renderPending:pending=>window.DG_DATA_REQUEST_PENDING_TABLE_UI.render($("aReqT"),pending,{escape:esc,actions:{
   fulfill:control=>fulfillRequest(Number(control.dataset.requestId)),
   reject:control=>rejectRequest(Number(control.dataset.requestId))
  }}),
  renderClosed:closed=>window.DG_DATA_REQUEST_CLOSED_TABLE_UI.renderSection(document,closed,{escape:esc})
 });
}

async function rejectRequest(id){
 return await window.DG_REJECT_DATA_REQUEST.execute(id,{
  confirm:()=>confirm(dgCf("Bu talebi reddetmek istediğinizden emin misiniz? Kullanıcıya yanıt gönderilmez, talep arşive kaldırılır.")),
  reject:requestId=>window.DG_DATA_REQUEST_STATUS_STORE.update(sb,requestId,"Reddedildi",new Date().toISOString()),
  onFailure:error=>toast("Hata: "+error.message,"err"),
  onSuccess:()=>toast("✓ Talep reddedildi","warn","🚫"),
  refresh:()=>loadRequests()
 });
}

async function fulfillRequest(id){
 return await window.DG_FULFILL_DATA_REQUEST.execute(id,{
  load:requestId=>window.DG_DATA_REQUEST_FULFILLMENT_STORE.load(sb,requestId),
  summarize:rows=>window.DG_DATA_REQUEST_DATASET_SUMMARY.summarize(rows),
  confirmEmpty:()=>confirm(dgCf("Bu filtreye uyan onaylı kayıt bulunamadı. Yine de kullanıcıya bilgilendirme maili göndermek ister misiniz?")),
  download:(rows,requestId)=>dl(fullCSV(rows),"dendrogeo_talep_"+requestId+".csv"),
  buildReply:(request,summary)=>window.DG_DATA_REQUEST_REPLY_CONTENT_UI.build(request,summary),
  openReply:(request,reply)=>window.DG_DATA_REQUEST_REPLY_WINDOW.open(window,request.email||"",reply.subject,reply.body),
  complete:requestId=>window.DG_DATA_REQUEST_STATUS_STORE.update(sb,requestId,"Tamamlandı",new Date().toISOString()),
  notify:()=>toast("✓ Mail hazırlandı — CSV'yi ekleyip gönderin","ok","📧"),
  refresh:()=>loadRequests()
 });
}
