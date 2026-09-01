const CACHE_NAME='dendrogeo-v1';
const urlsToCache=['./','./index.html','./manifest.json'];

self.addEventListener('install',e=>{
 e.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(urlsToCache)));
});

self.addEventListener('fetch',e=>{
 e.respondWith(
  caches.match(e.request).then(response=>response||fetch(e.request).catch(()=>caches.match('./index.html')))
 );
});

self.addEventListener('sync',e=>{
 if(e.tag==='sync-measurements'){
  e.waitUntil(syncOfflineData());
 }
});

async function syncOfflineData(){
 const db=await openDB();
 const tx=db.transaction('measurements','readonly');
 const store=tx.objectStore('measurements');
 const all=await store.getAll();
 
 for(const record of all){
  try{
   const response=await fetch('https://xjbpounwdxrhelmixvqm.supabase.co/rest/v1/measurements',{
    method:'POST',
    headers:{
     'Content-Type':'application/json',
     'apikey':record.apiKey,
     'Authorization':'Bearer '+record.token
    },
    body:JSON.stringify(record.data)
   });
   
   if(response.ok){
    const tx2=db.transaction('measurements','readwrite');
    tx2.objectStore('measurements').delete(record.id);
   }
  }catch(err){
   console.log('Sync failed, will retry:',err);
  }
 }
}

function openDB(){
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