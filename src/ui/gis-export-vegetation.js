/* Read the currently visible relative-NDVI polygons for PNG export. */
(function(root){
 "use strict";
 function pngLayers(sens){
  const layers=[];
  if(!sens?.vegetationLayer?.eachLayer)return layers;
  sens.vegetationLayer.eachLayer(layer=>{
   if(typeof layer.getLatLngs==="function")layers.push(layer);
  });
  return layers;
 }
 async function waitForLayers(sens,{attempts=8,tiers,render,pause}={}){
  if(!sens?.vegetationView)return[];
  if(typeof tiers==="function"){
   const summary=tiers();
   if(!summary||summary.count<9)return[];
  }
  let layers=pngLayers(sens);
  if(layers.length)return layers;
  if(typeof render==="function"){
   try{await render();}catch(error){}
  }
  const wait=pause||(()=>new Promise(resolve=>setTimeout(resolve,120)));
  for(let index=0;index<attempts;index++){
   layers=pngLayers(sens);
   if(layers.length)return layers;
   await wait();
  }
  return[];
 }
 root.DG_GIS_EXPORT_VEGETATION=Object.freeze({pngLayers,waitForLayers});
})(window);
