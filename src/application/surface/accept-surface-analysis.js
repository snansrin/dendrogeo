"use strict";

/* Persist an accepted surface result while guarding stale parks and draft fallback. */
window.DG_ACCEPT_SURFACE_ANALYSIS={
  async accept({record,sourceRecord,epoch,getEpoch,getRecord,buildResultSnapshot,setSaving,render,hasIdentity,saveAccount,getRevision,commit,renderAccepted,setEditing,clearFocus,saveLocal,setStatus,translate,toast,refresh}){
    const snapshot=record;
    setSaving(true);render();
    try{
      snapshot.acceptedResult=await buildResultSnapshot(snapshot);
      if(epoch!==getEpoch()||getRecord()!==sourceRecord)return false;
      if(!hasIdentity(snapshot))throw Error(translate("Hesaba kaydetmek için giriş yapın ve kayıtlı bir park seçin."));
      const revision=await saveAccount(snapshot,getRevision());
      if(epoch!==getEpoch())return false;
      snapshot.serverRevision=revision;commit(snapshot,revision);renderAccepted();setEditing(false);clearFocus();
      const cached=await saveLocal(),status=translate("✓ Sonuç hesabınıza kaydedildi; başka cihazda da açılabilir.")+(cached?"":" · "+translate("Cihaz önbelleği yazılamadı."));setStatus(status);toast(status,"ok");return true;
    }catch(error){
      if(epoch===getEpoch()){const local=await saveLocal(),status=translate("Hesaba kaydedilemedi: ")+String(error.message||error)+(local?" · "+translate("Yalnızca cihaz taslağı saklandı; hesap sonucu güncellenmedi."):"");setStatus(status);toast(status,"err");}
      return false;
    }finally{if(epoch===getEpoch()){setSaving(false);render();refresh();}}
  }
};
