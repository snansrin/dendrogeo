"use strict";
/* Bounded, georeferenced native tiles; no map screenshot, labels or overzoom. */
(function(root){
 function create({fetch:request}){
  const cache=new Map();
  async function tile(x,y,z,signal){
   const key=z+'/'+y+'/'+x;
   if(!cache.has(key)){
    if(cache.size>=128)cache.delete(cache.keys().next().value);
    cache.set(key,(async()=>{const response=await request('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/'+key+'?blankTile=false',{signal:AbortSignal.any([signal,AbortSignal.timeout(15000)])});if(!response.ok)throw Error('imagery_unavailable');const blob=await response.blob();if(!blob.type.startsWith('image/')||blob.size>2*1024*1024)throw Error('imagery_unavailable');return blob;})());
   }
   return cache.get(key);
  }
  async function read(chip,signal){
   const canvas=document.createElement('canvas');canvas.width=chip.width;canvas.height=chip.height;const context=canvas.getContext('2d');
   try{for(let y=Math.floor(chip.y/256);y<=Math.floor((chip.y+chip.height-1)/256);y++){
    if(signal.aborted)throw new DOMException('Cancelled','AbortError');
    const columns=[];for(let x=Math.floor(chip.x/256);x<=Math.floor((chip.x+chip.width-1)/256);x++)columns.push(x);
    // At most five parallel tile transfers and one decoded row at a time.
    const blobs=await Promise.all(columns.map(x=>tile(x,y,chip.zoom,signal)));
    for(let i=0;i<blobs.length;i++){const bitmap=await createImageBitmap(blobs[i]);try{if(bitmap.width!==256||bitmap.height!==256)throw Error('imagery_unavailable');context.drawImage(bitmap,columns[i]*256-chip.x,y*256-chip.y);}finally{bitmap.close();}}
   }
   const dataUrl=canvas.toDataURL('image/jpeg',.95),bytes=Uint8Array.from(atob(dataUrl.split(',')[1]),char=>char.charCodeAt(0)),digest=await root.crypto.subtle.digest('SHA-256',bytes),imageSha256=Array.from(new Uint8Array(digest),value=>value.toString(16).padStart(2,'0')).join('');
   return{dataUrl,imageSha256,width:chip.width,height:chip.height,imageId:String(chip.id)};
   }catch(error){if(error.name==='AbortError')throw error;throw Error(error.message==='park_too_large'?'park_too_large':'imagery_unavailable');}finally{canvas.width=canvas.height=1;}
  }
  return Object.freeze({read,clear:()=>cache.clear()});
 }
 root.DG_PARK_TREE_IMAGERY=Object.freeze({create});
})(window);
