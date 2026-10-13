"use strict";

/* Keep an optional screen wake lock alive while the field GPS is active. */
window.DG_MEASUREMENT_WAKE_LOCK_ADAPTER={
  create({getNavigator}){
    let lock=null;
    return Object.freeze({
      async acquire(){
        const nav=getNavigator();
        if(!("wakeLock" in nav))return;
        try{
          if(lock)return;
          lock=await nav.wakeLock.request("screen");
          lock.addEventListener("release",()=>{lock=null;});
        }catch(e){lock=null;}
      }
    });
  }
};
