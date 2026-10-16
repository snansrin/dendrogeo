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
 async function prepare(file){
  if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('invalid_image');
  if(file.size>10*1024*1024)throw Error('image_too_large');
  const bitmap=await createImageBitmap(file);
  try{
   if(bitmap.width*bitmap.height>80000000)throw Error('image_too_large');
   const scale=Math.min(1,2048/Math.max(bitmap.width,bitmap.height));
   const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
   const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap,0,0,canvas.width,canvas.height);
   const dataUrl=canvas.toDataURL('image/jpeg',.9);
   if(dataUrl.length>5*1024*1024)throw Error('image_too_large');
   return{dataUrl,width:canvas.width,height:canvas.height,imageId:file.name};
  }finally{bitmap.close();}
 }
 root.DG_TREE_DETECTION_CLIENT=Object.freeze({create,prepare});
})(window);
