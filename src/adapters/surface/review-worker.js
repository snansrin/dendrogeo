"use strict";
/* Worker lifecycle adapter for review geometry jobs. */
(function(root){
 function create({getWorker,scriptUrl,timeoutMs=90000,addTimer,removeTimer}){
  const schedule=addTimer||(typeof setTimeout==="function"?setTimeout:()=>null);
  const unschedule=removeTimer||(typeof clearTimeout==="function"?clearTimeout:()=>{});
  const jobs=new Set();
  function run(data){
   return new Promise((resolve,reject)=>{
    const WorkerCtor=getWorker();
    if(typeof WorkerCtor!=="function"){resolve(null);return;}
    let worker;try{worker=new WorkerCtor(scriptUrl());}catch(e){resolve(null);return;}
    let finished=false,timer;
    const finish=()=>{if(finished)return;finished=true;unschedule(timer);worker.terminate();jobs.delete(cancel);};
    const cancel=()=>{finish();reject(Error("Analiz kapatıldı."));};
    timer=schedule(()=>{finish();reject(Error("Sınır hesabı zaman aşımına uğradı."));},timeoutMs);
    jobs.add(cancel);
    worker.onmessage=e=>{finish();if(e.data.error)reject(Error(e.data.error));else resolve(e.data);};
    worker.onerror=()=>{finish();resolve(null);};
    try{worker.postMessage(data);}catch(e){finish();reject(e);}
   });
  }
  function cancelAll(){for(const cancel of [...jobs])cancel();}
  return Object.freeze({run,cancelAll});
 }
 root.DG_SURFACE_REVIEW_WORKER_ADAPTER=Object.freeze({create});
})(window);
