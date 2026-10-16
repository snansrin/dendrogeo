"use strict";
/* 0037: i18n güvenlikli yerel yardımcılar (harness'ler constants yüklemeyebilir). */
const _tof=(s)=>(typeof dgCf==="function"?dgCf(s):s);
const _toff=(t,v)=>(typeof dgTfs==="function"?dgTfs(t,v):String(t).replace(/\{(\w+)\}/g,(m,k)=>(v&&v[k]!=null?v[k]:m)));
/* ===== DendroGeo v2 · src/services/offline.js =====
Çevrimdışı ölçüm kuyruğu (IndexedDB) + senkronizasyon */

// 🎲 UUID v4 üretici (client_id için)
function uuidv4() {
return window.DG_OFFLINE_CLIENT_ID.create();
}
async function saveOfflineMeasurement(data){
return window.DG_OFFLINE_MEASUREMENT_QUEUE.save(data);
}
function openOfflineDB(){
return window.DG_OFFLINE_MEASUREMENT_QUEUE.open();
}
let DG_OFFLINE_SYNC=null;
async function syncOfflineData() {
return window.DG_COORDINATE_OFFLINE_MEASUREMENT_SYNC.run({getUser:()=>USER,isOnline:()=>navigator.onLine,updateBadge:updateSyncBadge,drain:dgSyncOfflineBatch});
}
function dgOfflineRequest(request){
return window.DG_OFFLINE_IDB_PROMISES.request(request);
}
function dgOfflineTransaction(tx){
return window.DG_OFFLINE_IDB_PROMISES.transaction(tx);
}
function dgOfflineSameMeasurement(local,remote){
return window.DG_OFFLINE_MEASUREMENT_MATCH.same(local,remote);
}
/* The queue worker composes the payload, lookup, upload, and persistence modules. */
async function dgSyncOfflineRecord(record,owner){
const data=record.data,editId=data._editId||null;
const required=window.DG_SYNC_QUEUED_MEASUREMENT&&window.DG_PREPARE_MEASUREMENT_SYNC_PAYLOAD&&window.DG_FIND_SAVED_OFFLINE_MEASUREMENT&&window.DG_UPLOAD_QUEUED_MEASUREMENT_PHOTO&&window.DG_PERSIST_QUEUED_MEASUREMENT;
if(!required)throw new Error('Çevrimdışı senkron modülleri yüklenemedi.');
return window.DG_SYNC_QUEUED_MEASUREMENT.run({record,owner,isCurrent:()=>!!USER&&String(USER.id)===owner&&navigator.onLine,client:sb,
findSaved:value=>window.DG_FIND_SAVED_OFFLINE_MEASUREMENT.find({client:sb,data:value,sameMeasurement:dgOfflineSameMeasurement}),
preparePayload:value=>window.DG_PREPARE_MEASUREMENT_SYNC_PAYLOAD.build(value),
uploadPhoto:({data:value,recordId})=>window.DG_UPLOAD_QUEUED_MEASUREMENT_PHOTO.upload({client:sb,data:value,recordId}),
persist:({payload,editId:recordEditId,owner:recordOwner,baseline})=>window.DG_PERSIST_QUEUED_MEASUREMENT.save({client:sb,payload,editId:recordEditId,owner:recordOwner,baseline})});
}
async function dgSyncOfflineBatch(owner){
 const viewState=window.DG_DASHBOARD_VIEW_STATE.create(document);
 return window.DG_DRAIN_OFFLINE_MEASUREMENT_QUEUE.run({owner,
  openDB:openOfflineDB,
  readAll:db=>dgOfflineRequest(db.transaction("measurements","readonly").objectStore("measurements").getAll()),
  remove:(db,id)=>window.DG_OFFLINE_MEASUREMENT_QUEUE.remove(db,id),
  isCurrent:currentOwner=>!!USER&&String(USER.id)===currentOwner&&navigator.onLine,
  syncRecord:dgSyncOfflineRecord,
  onSynced:async count=>{
   window.DG_OFFLINE_SYNC_FEEDBACK.synced(count);
   window.DG_REFRESH_AFTER_OFFLINE_MEASUREMENT_SYNC.run({isVisible:id=>viewState.isActive(id),loadDash,loadRecords,loadAdmin,loadWorld,markMapDirty:dgMarkLiveDirty,loadLiveMap:()=>typeof loadLiveMap==="function"&&loadLiveMap()});
  },
  onFailed:(count,error)=>window.DG_OFFLINE_SYNC_FEEDBACK.failed(count,error),
  onCritical:error=>window.DG_OFFLINE_SYNC_FEEDBACK.critical(error)
 });
}

/* ---- PWA KURULUM İSTEMİ (2026-09-20 Ar-Ge) ----
   beforeinstallprompt'u yakala; üst barda "📲 Uygulayı Kur" göster.
   iOS bu API'yi desteklemez → buton görünmez; Safari kullanıcıları
   Paylaş → Ana Ekrana Ekle ile kurar (manifest zaten hazır). */
async function dgInstallApp(){
 return window.DG_OFFLINE_INSTALL_PROMPT.install();
}
window.dgInstallApp=dgInstallApp;

/* ---- SENKRON ROZETİ: kuyruktaki ölçüm sayısı üst barda ----
   Saha kullanıcısı "kaç ölçümüm bekliyor?" sorusunun cevabını her an görür.
   saveOfflineMeasurement ve syncOfflineData sonrası otomatik güncellenir. */
async function updateSyncBadge(){
 return window.DG_OFFLINE_SYNC_BADGE.update();
}
window.updateSyncBadge=updateSyncBadge;
