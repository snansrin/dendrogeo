"use strict";
(function(root){
 function create({prepare,infer,normalize,present,makeAbortController}){
  let image=null,result=null,epoch=0,pending=null;
  const display=(state,error)=>present({state,error,image,result});
  function clear(){epoch++;pending?.abort();pending=null;image=null;result=null;display('empty');}
  async function select(file){
   clear();const job=epoch;display('preparing');
   try{const prepared=await prepare(file);if(job!==epoch)return;image=prepared;display('ready');}
   catch(error){if(job===epoch)display('error',error.message==='image_too_large'?'image_too_large':'invalid_image');}
  }
  async function run(confidence){
   if(!image||pending)return;
   const job=epoch;pending=makeAbortController();result=null;display('running');
   try{
    const response=await infer(image,confidence,pending.signal);
    if(job!==epoch)return;
    result=normalize(response,{width:image.width,height:image.height,imageId:image.imageId,modelId:response.modelId},{confidence,nmsIou:.5});
    display('complete');
   }catch(error){if(job===epoch)display('error',error.name==='AbortError'?'cancelled':error.message);}
   finally{if(job===epoch)pending=null;}
  }
  function cancel(){epoch++;pending?.abort();pending=null;result=null;display(image?'ready':'empty');}
  return Object.freeze({select,run,cancel,clear});
 }
 root.DG_DETECT_TREE_CANDIDATES=Object.freeze({create});
})(window);
