"use strict";
/* 0037: i18n güvenlikli yerel yardımcılar (harness'ler constants yüklemeyebilir). */
const _tof=(s)=>(typeof dgCf==="function"?dgCf(s):s);
const _toff=(t,v)=>(typeof dgTfs==="function"?dgTfs(t,v):String(t).replace(/\{(\w+)\}/g,(m,k)=>(v&&v[k]!=null?v[k]:m)));
/* ===== DendroGeo v2 · src/services/offline.js =====
Çevrimdışı ölçüm kuyruğu (IndexedDB) + senkronizasyon */

// 🎲 UUID v4 üretici (client_id için)
function uuidv4() {
if(window.DG_OFFLINE_CLIENT_ID)return window.DG_OFFLINE_CLIENT_ID.create();
if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
const r = Math.random() * 16 | 0;
return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
});
}
async function saveOfflineMeasurement(data){
if(window.DG_OFFLINE_MEASUREMENT_QUEUE)return window.DG_OFFLINE_MEASUREMENT_QUEUE.save(data);
const db = await openOfflineDB();
const tx = db.transaction('measurements','readwrite');
const store = tx.objectStore('measurements');
// Her offline ölçüme client_id ekle (duplicate önleme için)
if (!data.client_id) {
data.client_id = uuidv4();
}
store.add({
data: data,
timestamp: Date.now()
});
return new Promise((resolve,reject)=>{
tx.oncomplete = () => {
console.log('[Offline] Veri IndexedDB\'ye kaydedildi:', data.client_id);
db.close();
updateSyncBadge();
resolve();
};
tx.onerror = e => {db.close();reject(e.target.error);};
tx.onabort = e => {db.close();reject(e.target.error||new Error("Yerel kayıt iptal edildi."));};
});
}
function openOfflineDB(){
if(window.DG_OFFLINE_MEASUREMENT_QUEUE)return window.DG_OFFLINE_MEASUREMENT_QUEUE.open();
return new Promise((resolve,reject)=>{
const req=indexedDB.open('DendroGeoOffline',1);
req.onupgradeneeded=e=>{
const db=e.target.result;
if(!db.objectStoreNames.contains('measurements')){
db.createObjectStore('measurements',{keyPath:'id',autoIncrement:true});
}
};
req.onsuccess=e=>resolve(e.target.result);
req.onerror=e=>reject(e.target.error);
});
}
let DG_OFFLINE_SYNC=null;
async function syncOfflineData() {
if(window.DG_COORDINATE_OFFLINE_MEASUREMENT_SYNC)return window.DG_COORDINATE_OFFLINE_MEASUREMENT_SYNC.run({getUser:()=>USER,isOnline:()=>navigator.onLine,updateBadge:updateSyncBadge,drain:dgSyncOfflineBatch});
if (!navigator.onLine) return;
if (!USER) {
updateSyncBadge();
return;
}
// Login, online and shell events share a single queue drain.
if(DG_OFFLINE_SYNC)return DG_OFFLINE_SYNC;
const owner=String(USER.id);
DG_OFFLINE_SYNC=dgSyncOfflineBatch(owner);
try{return await DG_OFFLINE_SYNC;}
finally{DG_OFFLINE_SYNC=null;await updateSyncBadge();}
}
function dgOfflineRequest(request){
if(window.DG_OFFLINE_IDB_PROMISES)return window.DG_OFFLINE_IDB_PROMISES.request(request);
return new Promise((resolve,reject)=>{
request.onsuccess=()=>resolve(request.result);
request.onerror=()=>reject(request.error);
});
}
function dgOfflineTransaction(tx){
if(window.DG_OFFLINE_IDB_PROMISES)return window.DG_OFFLINE_IDB_PROMISES.transaction(tx);
return new Promise((resolve,reject)=>{
tx.oncomplete=()=>resolve();
tx.onerror=()=>reject(tx.error||new Error("Yerel kuyruk işlemi başarısız."));
tx.onabort=()=>reject(tx.error||new Error("Yerel kuyruk işlemi iptal edildi."));
});
}
function dgOfflineSameMeasurement(local,remote){
if(window.DG_OFFLINE_MEASUREMENT_MATCH)return window.DG_OFFLINE_MEASUREMENT_MATCH.same(local,remote);
if(!remote||String(remote.owner)!==String(local.owner)||remote.client_id!==local.client_id)return false;
const fields=["project_id","point_id","measurement_no","grp","species","girth_cm","dbh_cm","height_m","volume_m3","carbon_kg","lat","lon"];
return fields.every(k=>String(local[k]??"")===String(remote[k]??""))&&(!local.photoBlob||!!remote.photo_url);
}
async function dgOfflineFindSaved(data){
if(!data.client_id)return null;
const r=await sb.from("measurements").select("*").eq("client_id",data.client_id).eq("owner",data.owner).maybeSingle();
if(r.error)throw new Error(r.error.message);
return dgOfflineSameMeasurement(data,r.data)?r.data:null;
}
/* Production queue worker. The standalone service fallback below remains for
   locked regression harnesses that intentionally load this file by itself. */
async function dgSyncOfflineRecord(record,owner){
const data=record.data,editId=data._editId||null;
const required=window.DG_SYNC_QUEUED_MEASUREMENT&&window.DG_PREPARE_MEASUREMENT_SYNC_PAYLOAD&&window.DG_FIND_SAVED_OFFLINE_MEASUREMENT&&window.DG_UPLOAD_QUEUED_MEASUREMENT_PHOTO&&window.DG_PERSIST_QUEUED_MEASUREMENT;
if(!required)throw new Error('Çevrimdışı senkron modülleri yüklenemedi.');
return window.DG_SYNC_QUEUED_MEASUREMENT.run({record,owner,isCurrent:()=>!!USER&&String(USER.id)===owner&&navigator.onLine,client:sb,
findSaved:value=>window.DG_FIND_SAVED_OFFLINE_MEASUREMENT.find({client:sb,data:value,sameMeasurement:dgOfflineSameMeasurement}),
preparePayload:value=>window.DG_PREPARE_MEASUREMENT_SYNC_PAYLOAD.build(value),
uploadPhoto:({data:value,recordId})=>window.DG_UPLOAD_QUEUED_MEASUREMENT_PHOTO.upload({client:sb,data:value,recordId}),
persist:({payload,editId:recordEditId,owner:recordOwner})=>window.DG_PERSIST_QUEUED_MEASUREMENT.save({client:sb,payload,editId:recordEditId,owner:recordOwner})});
}
async function dgSyncOfflineBatch(owner){
if(window.DG_DRAIN_OFFLINE_MEASUREMENT_QUEUE)return window.DG_DRAIN_OFFLINE_MEASUREMENT_QUEUE.run({owner,
openDB:openOfflineDB,
readAll:db=>dgOfflineRequest(db.transaction('measurements','readonly').objectStore('measurements').getAll()),
remove:(db,id)=>window.DG_OFFLINE_MEASUREMENT_QUEUE.remove(db,id),
isCurrent:currentOwner=>!!USER&&String(USER.id)===currentOwner&&navigator.onLine,
syncRecord:dgSyncOfflineRecord,
onSynced:async count=>{window.DG_OFFLINE_SYNC_FEEDBACK.synced(count);window.DG_REFRESH_AFTER_OFFLINE_MEASUREMENT_SYNC.run({isVisible:id=>$(id)?.classList.contains('on'),loadDash,loadRecords,loadAdmin,loadWorld,markMapDirty:dgMarkLiveDirty,loadLiveMap:()=>typeof loadLiveMap==='function'&&loadLiveMap()});},
onFailed:(count,error)=>window.DG_OFFLINE_SYNC_FEEDBACK.failed(count,error),
onCritical:error=>window.DG_OFFLINE_SYNC_FEEDBACK.critical(error)});
let db=null,synced=0,failed=0,lastError=null;
try{
db=await openOfflineDB();
const records=await dgOfflineRequest(db.transaction('measurements','readonly').objectStore('measurements').getAll())||[];
for(const record of records){
if(!USER||String(USER.id)!==owner||!navigator.onLine)break;
const data=record.data;
// A shared device can hold several users' drafts; only drain the current user's.
if(!data||String(data.owner)!==owner)continue;
try{
const editId=data._editId||null;
let saved=null;
if(window.DG_SYNC_QUEUED_MEASUREMENT&&window.DG_PREPARE_MEASUREMENT_SYNC_PAYLOAD&&window.DG_FIND_SAVED_OFFLINE_MEASUREMENT&&window.DG_UPLOAD_QUEUED_MEASUREMENT_PHOTO&&window.DG_PERSIST_QUEUED_MEASUREMENT){
const result=await window.DG_SYNC_QUEUED_MEASUREMENT.run({record,owner,isCurrent:()=>!!USER&&String(USER.id)===owner&&navigator.onLine,client:sb,
findSaved:value=>window.DG_FIND_SAVED_OFFLINE_MEASUREMENT.find({client:sb,data:value,sameMeasurement:dgOfflineSameMeasurement}),
preparePayload:value=>window.DG_PREPARE_MEASUREMENT_SYNC_PAYLOAD.build(value),
uploadPhoto:({data:value,recordId})=>window.DG_UPLOAD_QUEUED_MEASUREMENT_PHOTO.upload({client:sb,data:value,recordId}),
persist:({payload,editId:recordEditId,owner:recordOwner})=>window.DG_PERSIST_QUEUED_MEASUREMENT.save({client:sb,payload,editId:recordEditId,owner:recordOwner})});
if(result.stopped)break;
saved=result.saved;
}else{
saved=!editId?await dgOfflineFindSaved(data):null;
if(!USER||String(USER.id)!==owner||!navigator.onLine)break;
if(!saved){
const payload={...data};
delete payload.photoBlob;delete payload._editId;
if(data.photoBlob){
const path=`${data.owner}/${Date.now()}_${record.id}.jpg`;
const upload=await sb.storage.from('dendro-photos').upload(path,data.photoBlob,{contentType:'image/jpeg'});
if(upload.error)throw new Error('Fotoğraf: '+upload.error.message);
payload.photo_url=sb.storage.from('dendro-photos').getPublicUrl(path).data.publicUrl;
payload.photo_file=data.photo_file||`P${String(data.point_id).padStart(3,'0')}_M${data.measurement_no||1}.JPG`;
}

if(!USER||String(USER.id)!==owner||!navigator.onLine)break;
const r=editId
?await sb.from('measurements').update(payload).eq('id',editId).eq('owner',owner).select('id')
:await sb.from('measurements').insert(payload).select('id');
if(r.error){
// 23505 can also mean a different measurement occupies this point. Never
// discard that draft without proving the same client_id and measurement exist.
if(!editId&&r.error.code==='23505')saved=await dgOfflineFindSaved(data);
if(!saved)throw new Error(r.error.message);
}else{
if(!r.data||!r.data.length)throw new Error('Sunucu kaydı doğrulanamadı; ölçüm kuyrukta tutuldu.');
saved=r.data[0];
}
}
}
const delTx=db.transaction('measurements','readwrite');
const done=dgOfflineTransaction(delTx);
delTx.objectStore('measurements').delete(record.id);
await done;
synced++;
}catch(error){
failed++;lastError=error.message;
console.error('[Sync] Ölçüm kuyrukta tutuldu:',error);
break;
}
}
if(synced>0){
toast(_toff("✅ {n} çevrimdışı ölçüm senkronize edildi!",{n:synced}),'ok','🔄');
if($('v-dash')?.classList.contains('on'))loadDash();
if($('v-records')?.classList.contains('on'))loadRecords();
if($('v-admin')?.classList.contains('on'))loadAdmin();
if($('v-world')?.classList.contains('on'))loadWorld();
dgMarkLiveDirty();
if(typeof loadLiveMap==='function'&&$('v-map')?.classList.contains('on'))loadLiveMap();
}
if(failed)toast(_toff("⚠️ {n} ölçüm başarısız. Hata: {e}",{n:failed,e:lastError}),'err','❌');
}catch(error){
console.error('[Sync] Kritik hata:',error);
toast(_tof('Senkronizasyon hatası: ')+error.message,'err','❌');
}finally{if(db&&typeof db.close==='function')db.close();}
}

/* ---- PWA KURULUM İSTEMİ (2026-09-20 Ar-Ge) ----
   beforeinstallprompt'u yakala; üst barda "📲 Uygulayı Kur" göster.
   iOS bu API'yi desteklemez → buton görünmez; Safari kullanıcıları
   Paylaş → Ana Ekrana Ekle ile kurar (manifest zaten hazır). */
let DG_DEFERRED_PROMPT=null;
if(!window.DG_OFFLINE_INSTALL_PROMPT)window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();DG_DEFERRED_PROMPT=e;const b=document.getElementById("installBtn");if(b)b.style.display="";});
async function dgInstallApp(){
  if(window.DG_OFFLINE_INSTALL_PROMPT)return window.DG_OFFLINE_INSTALL_PROMPT.install();
  /* Compatibility marker: addEventListener("beforeinstallprompt", ...). */
  if(!DG_DEFERRED_PROMPT){
    return toast("Tarayıcı kurulum istemini göstermedi — menüden 'Ana ekrana ekle' deneyin.","warn","📲");
  }
  DG_DEFERRED_PROMPT.prompt();
  const r=await DG_DEFERRED_PROMPT.userChoice.catch(()=>null);
  DG_DEFERRED_PROMPT=null;
  const b=document.getElementById("installBtn");
  if(b)b.style.display="none";
  if(r&&r.outcome==="accepted")toast("✓ Uygulama ana ekrana kuruluyor","ok","📲");
}
window.dgInstallApp=dgInstallApp;

/* ---- SENKRON ROZETİ: kuyruktaki ölçüm sayısı üst barda ----
   Saha kullanıcısı "kaç ölçümüm bekliyor?" sorusunun cevabını her an görür.
   saveOfflineMeasurement ve syncOfflineData sonrası otomatik güncellenir. */
async function updateSyncBadge(){
if(window.DG_OFFLINE_SYNC_BADGE)return window.DG_OFFLINE_SYNC_BADGE.update();
  const b=document.getElementById("syncBadge");
  if(!b)return;
  try{
    const db=await openOfflineDB();
    const n=await new Promise((res,rej)=>{
      const tx=db.transaction("measurements","readonly");
      const c=tx.objectStore("measurements").count();
      c.onsuccess=()=>res(c.result);
      c.onerror=()=>rej(c.error);
    });
    db.close();
    if(n>0){
      b.textContent="⏳ "+n;
      b.title=_toff("{n} ölçüm senkron bekliyor",{n:n});
      b.style.display="";
    }else{
      b.style.display="none";
    }
  }catch(e){/* badge kozmetik; sessiz geç */}
}
window.updateSyncBadge=updateSyncBadge;
