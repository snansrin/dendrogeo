"use strict";

/* Serialized, rate-limited Nominatim transport with a bounded request time. */
window.DG_NOMINATIM_CLIENT_ADAPTER = {
  create({
    fetchImpl=(...args)=>fetch(...args),
    URLSearchParamsImpl=URLSearchParams,
    AbortControllerImpl=null,
    now=()=>Date.now(),
    setTimer=(...args)=>setTimeout(...args),
    clearTimer=timer=>clearTimeout(timer),
    minIntervalMs=1000,
    timeoutMs=15000
  }={}) {
    let queue=Promise.resolve();
    let lastRequestAt=0;

    function request(params) {
      const task=queue.catch(()=>{}).then(async()=>{
        const wait=Math.max(0,minIntervalMs-(now()-lastRequestAt));
        if(wait)await new Promise(resolve=>setTimer(resolve,wait));
        lastRequestAt=now();
        const Controller=AbortControllerImpl||globalThis.AbortController;
        const controller=new Controller();
        const timer=setTimer(()=>controller.abort(),timeoutMs);
        try {
          const response=await fetchImpl(
            "https://nominatim.openstreetmap.org/"+params.path+"?"+new URLSearchParamsImpl(params.query),
            {headers:{Accept:"application/json"},signal:controller.signal}
          );
          if(!response.ok)throw new Error("OSM sınır servisi HTTP "+response.status);
          const data=await response.json();
          if(!Array.isArray(data))throw new Error("OSM sınır yanıtı geçersiz");
          return data;
        } finally {
          clearTimer(timer);
        }
      });
      queue=task;
      return task;
    }

    return Object.freeze({request});
  }
};
