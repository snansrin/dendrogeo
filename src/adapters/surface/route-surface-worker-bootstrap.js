"use strict";

/* Route only the legacy surface-worker URL through its additive bootstrap. */
(function(root){
 const NativeWorker=root.Worker;
 if(typeof NativeWorker!=="function"||root.__DG_SURFACE_WORKER_BOOTSTRAP_ROUTED)return;
 const WORKER_PATH="/src/workers/surface-worker.js",BOOTSTRAP_PATH="/src/workers/surface-worker-bootstrap.js";
 root.Worker=new Proxy(NativeWorker,{
  construct(target,args,newTarget){
   const script=args[0];
   if(typeof script==="string"&&script.includes(WORKER_PATH))args[0]=script.replace(WORKER_PATH,BOOTSTRAP_PATH);
   return Reflect.construct(target,args,newTarget);
  }
 });
 root.__DG_SURFACE_WORKER_BOOTSTRAP_ROUTED=true;
})(window);
