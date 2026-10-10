"use strict";
/* Own the single-build lock and button lifecycle around the grid application. */
(function(root){
 function createGridBuildController({getPark,getOptions,nextEpoch,getButton,build,accept,notify}){
  let busy=false;
  return async function runGridBuild(){
   if(busy)return;
   const park=getPark();
   if(!park?.length)return notify("Önce park seç","warn");
   const {size,clearance}=getOptions();
   const epoch=nextEpoch(),button=getButton();busy=true;
   if(button){button.disabled=true;button.textContent="⏳ Grid hazırlanıyor…";}
   try{
    const context={park,epoch,size,clearance};
    const outcome=await build(context);
    if(outcome.status==="stale")return;
    accept(outcome,context);
   }catch(error){notify(String(error.message||error),"err","🔲");}
   finally{busy=false;if(button?.isConnected){button.disabled=false;button.textContent="🔲 Grid Oluştur";}}
  };
 }
 root.DG_GRID_BUILD_CONTROLLER_UI=Object.freeze({create:createGridBuildController});
})(window);
