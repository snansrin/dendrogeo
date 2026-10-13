"use strict";
/* Load the park-scoped local draft and authoritative account snapshot, then normalize. */
(function(root){
 async function load({createFresh,loadLocal,loadRemote,selectSource,normalize,setStatus,translate}){
  const fresh=createFresh(),local=await loadLocal(fresh);let remote=null,revision=0;
  try{const loaded=await loadRemote(fresh);if(loaded){remote=loaded.payload;remote.fingerprint=loaded.source_fingerprint;revision=loaded.revision;}}
  catch(error){setStatus(translate("Hesap kaydı yüklenemedi; cihaz taslağı kullanılıyor."));}
  const selection=selectSource({fresh,local,remote}),result=normalize({fresh,source:selection.record,revision});
  if(result.invalidAccepted)setStatus(translate("Kayıtlı sınır ile analiz özeti uyuşmadı. Eski sonuç gösterilmiyor; önizlemeyi kontrol edip yeniden kabul edin."));
  return result.record;
 }
 root.DG_LOAD_SURFACE_REVIEW_RECORD=Object.freeze({load});
})(window);
