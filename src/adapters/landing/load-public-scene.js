"use strict";
/* Public, versioned display data only. No session credentials or application records. */
(function(root){
 const cache=new Map();
 function load(url){
  if(!cache.has(url))cache.set(url,(async()=>{
   const controller=new AbortController(),timer=root.setTimeout(()=>controller.abort(),10000);
   try{const response=await root.fetch(url,{credentials:'omit',signal:controller.signal});if(!response.ok)throw Error('Scene unavailable');return await response.json();}
   catch(error){cache.delete(url);throw error;}finally{root.clearTimeout(timer);}
  })());
  return cache.get(url);
 }
 root.DG_PUBLIC_LANDING_SCENE=Object.freeze({load});
})(window);
