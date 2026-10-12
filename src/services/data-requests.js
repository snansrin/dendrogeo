"use strict";
/* DendroGeo · services/data-requests.js — VERİ TALEP AKIŞI (Faz 6)
 * admin.js'ten birebir taşındı: kullanıcı tarafı talep formu
 * (sendDataRequest/loadMyRequests/loadRequestOptions/req*Changed) ve
 * yönetici tarafı talep kuyruğu (loadRequests/rejectRequest/fulfillRequest).
 * REQ_ROWS/REQ_PROJECTS state'i admin.js (çekirdek) içindedir — çağrı anında
 * global lexical kapsamdan çözülür (admin.js bu dosyadan SONRA yüklenir ama
 * tüm çağrılar boot sonrasında olur). */

/* ============ VERİ TALEBİ (kullanıcı → yönetici) ============ */
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
   m.style.color="var(--amber)";
   m.textContent=(typeof dgTfs==="function"?dgTfs("⚠ Aynı filtreyle bir talebiniz zaten {s}. Yönetici yanıt verene kadar yeni talep oluşturulamaz.",{s:(dup.status==="Beklemede"?"beklemede":"işleme alındı")}):("⚠ Aynı filtreyle bir talebiniz zaten "+(dup.status==="Beklemede"?"beklemede":"işleme alındı")+". Yönetici yanıt verene kadar yeni talep oluşturulamaz."));
  },
  onCheckError:error=>console.log("Dup kontrolü:",error),
  buildBody:()=>({user_id:USER.id,email:PROFILE?.email||USER.email,country,city,project_name,note,status:"Beklemede"}),
  insert:body=>window.DG_DATA_REQUEST_SUBMIT_STORE.insert(sb,body),
  onInsertError:error=>{m.style.color="var(--red)";m.textContent="Hata: "+error.message;},
  onSuccess:()=>{
   toast("✓ Talep gönderildi — yönetici yanıtı bekleniyor","ok","✉️");
   m.style.color="var(--green-dk)";m.textContent="✓ Talebiniz yönetime iletildi, hazır olduğunda e‑postanıza gönderilecek.";
   $("reqCountry").value="";$("reqCity").value="";$("reqProject").value="";$("reqNote").value="";
   loadMyRequests();
  }
 });
}

/* 0040: kaydırma koruma sarmalı — yeniden çizimde #main scrollTop korunur. */
async function loadMyRequests(){const _y=(typeof dgScrollKeep==="function"?dgScrollKeep():null);try{return await loadMyRequests__scroll.apply(this,arguments);}finally{if(typeof dgScrollRestore==="function")dgScrollRestore(_y);}}
async function loadMyRequests__scroll(){
 if(!USER)return;
 const{data,error}=await window.DG_MY_DATA_REQUESTS_STORE.load(sb,USER.id);
 const el=$("myRequests");if(!el)return;
 if(error){el.innerHTML='<div class="alert err">Talepler yüklenemedi.</div>';return;}
 if(!data||!data.length){el.innerHTML="";return;}
 window.DG_MY_DATA_REQUESTS_UI.render(el,data,{escape:esc});
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
 try{
  const {measurements:m,projects:p}=await window.DG_DATA_REQUEST_OPTIONS_STORE.load(sb);
  REQ_ROWS=m.data||[];REQ_PROJECTS=p.data||[];
  /* Ülke/şehir seçenek listeleri kesilmişse talep formunda eksik seçenek görünür. */
  dgWarnIfTruncated(m.data,5000,"Talep formu seçenekleri",m.count);
  fillSelect($("reqCountry"),listCountries(REQ_ROWS,REQ_PROJECTS));
  reqCountryChanged();
 }catch(e){}
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
 const{data}=await window.DG_DATA_REQUEST_QUEUE_STORE.load(sb);
 const reqs=data||[];
 const {pending,closed}=window.DG_DATA_REQUEST_QUEUE.partition(reqs);
 
 $("aReqPending").textContent=pending.length;
 $("aReqPendingMini").textContent=pending.length;
 $("aReqClosed").textContent=closed.length;
 
 // AKTİF TALEPLER TABLOSU
 window.DG_DATA_REQUEST_PENDING_TABLE_UI.render($("aReqT"),pending,{escape:esc});
 
 // TAMAMLANAN/REDDEDİLENLER (COLLAPSIBLE)
 const closedWrap=$("closedRequestsWrap");
 if(closed.length>0){
  closedWrap.style.display="block";
  $("aReqClosed").textContent=closed.length;
  window.DG_DATA_REQUEST_CLOSED_TABLE_UI.render($("closedReqT"),closed,{escape:esc});
 }else{
  closedWrap.style.display="none";
 }
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
