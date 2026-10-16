"use strict";
(function(root){
 function create({client,url,publicKey,fetch:request}){
  return async function infer(image,confidence,signal){
   const {data,error}=await client.auth.getSession();
   if(error||!data.session?.access_token)throw Error('sign_in_required');
   const response=await request(url+'/functions/v1/tree-detection',{method:'POST',headers:{'Content-Type':'application/json',apikey:publicKey,Authorization:'Bearer '+data.session.access_token},body:JSON.stringify({image:image.dataUrl.split(',')[1],width:image.width,height:image.height,confidence}),signal});
   const result=await response.json().catch(()=>({error:'model_unavailable'}));
   if(!response.ok)throw Error(result.error||'model_unavailable');
   return result;
  };
 }
 root.DG_TREE_DETECTION_CLIENT=Object.freeze({create});
})(window);
