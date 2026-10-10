"use strict";
/* Preserve save-before-clear ordering when returning to park selection. */
(function(root){
 function create({isBusy,getSave,clearPark,clearGrid,clearAnalysis,hideInfo,getMode,toggleMode,bindClick,resizeMap,scrollMap,notify}){
  return async function chooseNewParkController(){
   if(isBusy())return;
   const save=getSave();if(save)await save();
   clearPark();clearGrid();clearAnalysis();hideInfo();
   if(!getMode())toggleMode();else bindClick();
   resizeMap();scrollMap();notify();
  };
 }
 root.DG_CHOOSE_NEW_PARK_CONTROLLER_UI=Object.freeze({create});
})(window);
