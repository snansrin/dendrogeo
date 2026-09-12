"use strict";
/* ===== DendroGeo v2 · src/services/offline.js =====
Çevrimdışı ölçüm kuyruğu (IndexedDB) + senkronizasyon */

// 🎲 UUID v4 üretici (client_id için)
function uuidv4() {
if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
const r = Math.random() * 16 | 0;
return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
});
}
async function saveOfflineMeasurement(data){
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
resolve();
};
tx.onerror = e => reject(e.target.error);
});
}
function openOfflineDB(){
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
async function syncOfflineData() {
if (!navigator.onLine) return;
if (!USER) {
console.warn('[Sync] Kullanıcı giriş yapmamış, senkronizasyon atlanıyor');
return;
}
try {
const db = await openOfflineDB();
const tx = db.transaction('measurements', 'readonly');
const store = tx.objectStore('measurements');
const req = store.getAll();
req.onsuccess = async () => {
const records = req.result || [];
if (!records.length) {
console.log('[Sync] ✅ Kuyruk boş.');
return;
}
console.log(`[Sync] 🚀 ${records.length} offline ölçüm senkronize ediliyor...`);
let synced = 0;
let failed = 0;
let lastError = null;
for (const record of records) {
const { data } = record;
try {
let photoUrl = null;
let photoFile = null;
// 1. Fotoğraf Varsa Supabase Storage'a Yükle
if (data.photoBlob) {
photoFile = `P${String(data.point_id).padStart(3, '0')}_M${data.measurement_no || 1}.JPG`;
const path = `${data.owner}/${Date.now()}_${record.id}.jpg`;
const { error } = await sb.storage.from('dendro-photos').upload(path, data.photoBlob, { contentType: 'image/jpeg' });
if (!error) {
photoUrl = sb.storage.from('dendro-photos').getPublicUrl(path).data.publicUrl;
} else {
console.warn('[Sync] Fotoğraf hatası:', error.message);
failed++;
lastError = 'Fotoğraf: ' + error.message;
continue;
}
}
// 2. Payload hazırla
const payload = { ...data };
if (photoUrl) {
payload.photo_url = photoUrl;
payload.photo_file = photoFile;
}
delete payload.photoBlob; // Blob DB'ye gitmez
// ⭐ KRİTİK: client_id payload'a ekle (duplicate önleme)
if (data.client_id) {
payload.client_id = data.client_id;
}
console.log('[Sync] Insert ediliyor:', payload.point_id, 'client_id:', payload.client_id);
// 3. Supabase'e insert et (offline düzenleme ise UPDATE)
const editId = data._editId || null;
delete payload._editId;
let error;
if (editId) {
const res = await sb.from('measurements').update(payload).eq('id', editId);
error = res.error;
} else {
const res = await sb.from('measurements').insert(payload);
error = res.error;
}
if (!error) {
// ✅ Başarılı → kuyruktan sil
const delTx = db.transaction('measurements', 'readwrite');
delTx.objectStore('measurements').delete(record.id);
synced++;
console.log(`[Sync] ✅ P${data.point_id} başarıyla senkronize edildi`);
} else if (error.code === '23505') {
// ⚠️ Duplicate key → zaten kaydedilmiş, kuyruktan sil
console.warn(`[Sync] ⚠️ P${data.point_id} zaten mevcut (duplicate), kuyruktan siliniyor`);
const delTx = db.transaction('measurements', 'readwrite');
delTx.objectStore('measurements').delete(record.id);
} else {
// ❌ Gerçek hata → kullanıcıya göster!
console.error('[Sync] ❌ Insert hatası:', error);
failed++;
lastError = error.message;
toast(`❌ P${data.point_id} senkronize edilemedi: ${error.message}`, 'err', '⚠️');
break; // Sırayı bozma, diğer online'da tekrar dene
}
} catch (err) {
console.error('[Sync] Record hatası:', err);
failed++;
lastError = err.message;
break;
}
}
// 📢 Sonuç bildirimi
if (synced > 0) {
toast(`✅ ${synced} çevrimdışı ölçüm senkronize edildi!`, 'ok', '🔄');
if ($('v-dash').classList.contains('on')) loadDash();
if ($('v-records').classList.contains('on')) loadRecords();
if ($('v-admin').classList.contains('on')) loadAdmin();
if ($('v-world').classList.contains('on')) loadWorld();
}
if (failed > 0) {
toast(`⚠️ ${failed} ölçüm başarısız. Hata: ${lastError}`, 'err', '❌');
}
};
} catch (e) {
console.error("[Sync] Kritik hata:", e);
toast('Senkronizasyon hatası: ' + e.message, 'err', '❌');
}
}
