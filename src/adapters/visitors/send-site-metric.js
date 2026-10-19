(function(root){
 'use strict';
 async function send(config,payload,{fetcher,AbortController,setTimeout,clearTimeout}){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),4000);
  try{const response=await fetcher(config.url,{method:'POST',credentials:'omit',referrerPolicy:'origin',keepalive:true,signal:controller.signal,headers:{'Content-Type':'application/json',apikey:config.key,Authorization:'Bearer '+config.key},body:JSON.stringify(payload)});return response.ok;}catch{return false;}finally{clearTimeout(timer);}
 }
 root.DG_SEND_SITE_METRIC=Object.freeze({send});
})(window);
