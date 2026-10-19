"use strict";
/* Selects only the existing public, saved landing scenes. */
(function(root){
 function create(){
  function selectScene(index){
   if(![1,2].includes(index))return false;
   const showcase=document.querySelector("[data-dg-showcase]");
   const button=showcase?.querySelector(`[data-showcase-index="${index}"]`);
   if(!button)return false;
   if(button.getAttribute("aria-pressed")!=="true")button.click();
   return true;
  }
  return Object.freeze({selectScene});
 }
 root.DG_GUIDED_MAP_DEMO_ADAPTER=Object.freeze({create});
})(window);
