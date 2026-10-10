"use strict";
/* Own build invalidation and accepted-grid metadata independently of the DOM. */
(function(root){
 function create({cells=[],selection=new Set()}={}){
  let epoch=0,renderer=null,source=null,meta="";
  return Object.freeze({
   getCells:()=>cells,getSelection:()=>selection,
   getEpoch:()=>epoch,nextEpoch:()=>++epoch,
   getRenderer:()=>renderer,setRenderer:value=>{renderer=value;},
   getSource:()=>source,setSource:value=>{source=value;},
   getMeta:()=>meta,setMeta:value=>{meta=value;},
   invalidate:()=>{meta="";source=null;return ++epoch;}
  });
 }
 root.DG_GRID_SESSION_STATE=Object.freeze({create});
})(window);
