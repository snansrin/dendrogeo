"use strict";
(function(root){
 function activate({api,widgets,activeId,getElement}){
  ["tsLogin","tsReg","tsReset"].forEach(id=>{
   if(id!==activeId&&widgets[id]!==undefined){
    try{api.remove(widgets[id]);delete widgets[id];}catch(error){console.warn("TS remove error",id,error);}
   }
  });
  const element=getElement(activeId);
  if(element&&widgets[activeId]===undefined){
   try{widgets[activeId]=api.render(element,{sitekey:"0x4AAAAAAEkJfXuFvNgUrwUb",theme:"light"});}
   catch(error){console.warn("TS render error",activeId,error);}
  }
 }
 root.DG_TURNSTILE_WIDGET=Object.freeze({activate});
})(window);
