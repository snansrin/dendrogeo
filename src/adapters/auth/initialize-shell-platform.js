"use strict";
/* Platform registration never delays authentication or restores a stale screen. */
window.DG_INITIALIZE_SHELL_PLATFORM={initialize({window,navigator,schedule,syncOfflineData,notify,log}){
 if('serviceWorker' in navigator&&!window._swRegistered){window._swRegistered=true;navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(reg=>{reg.update();schedule(()=>navigator.serviceWorker.ready.then(ready=>ready.active?.postMessage({type:'PRECACHE_REMAINING'})).catch(()=>{}),12000)}).catch(error=>log('SW registration failed:',error));}
 if(navigator.storage?.persist&&!window._persistChecked){window._persistChecked=true;navigator.storage.persist().then(ok=>{window._storagePersisted=ok}).catch(()=>{});}
 if(!window._onlineListenerSet){window._onlineListenerSet=true;window.addEventListener('online',()=>{notify('İnternet bağlantısı geri geldi — senkronize ediliyor','ok','🌐');schedule(()=>syncOfflineData(),1500)});}
}};
