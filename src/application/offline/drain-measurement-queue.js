"use strict";

/* Drain only the active owner's queue, retaining rows unless server sync and
   the IndexedDB delete transaction both complete successfully. */
(function(root){
  async function run({owner,openDB,readAll,remove,isCurrent,syncRecord,onSynced,onFailed,onCritical}){
    let db=null,synced=0,failed=0,lastError=null;
    try{
      db=await openDB();
      const records=await readAll(db)||[];
      for(const record of records){
        if(!isCurrent(owner))break;
        const data=record&&record.data;
        if(!data||String(data.owner)!==owner)continue;
        try{
          const result=await syncRecord(record,owner);
          if(result&&result.stopped)break;
          if(!isCurrent(owner))break;
          await remove(db,record.id);
          synced++;
        }catch(error){
          failed++;
          lastError=error&&error.message?error.message:String(error);
          console.error('[Sync] Ölçüm kuyrukta tutuldu:',error);
          break;
        }
      }
      if(synced)await onSynced(synced);
      if(failed)onFailed(failed,lastError);
      return{synced,failed,lastError};
    }catch(error){
      console.error('[Sync] Kritik hata:',error);
      onCritical(error);
      return{synced,failed,lastError,error};
    }finally{
      if(db&&typeof db.close==='function')db.close();
    }
  }
  root.DG_DRAIN_OFFLINE_MEASUREMENT_QUEUE=Object.freeze({run});
})(window);
