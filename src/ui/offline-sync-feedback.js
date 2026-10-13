"use strict";

/* Keep the established Turkish copy and toast severity for offline sync. */
(function(root){
  const format=(text,values)=>typeof root.dgTfs==='function'?root.dgTfs(text,values):String(text).replace(/\{(\w+)\}/g,(m,k)=>values&&values[k]!=null?values[k]:m);
  function synced(count){root.toast(format("✅ {n} çevrimdışı ölçüm senkronize edildi!",{n:count}),'ok','🔄');}
  function failed(count,error){root.toast(format("⚠️ {n} ölçüm başarısız. Hata: {e}",{n:count,e:error}),'err','❌');}
  function critical(error){root.toast((typeof root.dgCf==='function'?root.dgCf('Senkronizasyon hatası: '):'Senkronizasyon hatası: ')+error.message,'err','❌');}
  root.DG_OFFLINE_SYNC_FEEDBACK=Object.freeze({synced,failed,critical});
})(window);
