"use strict";
/* Canonical blank record for a single owner's selected park review. */
(function(root){
 function create({park,owner,createdAt}){
  return{id:"surface-"+(owner||"guest")+"-"+(park.id||"x"),owner,parkId:park.id,parkName:park.name,sens:{green:50,water:50,hard:50,bare:50},corrections:{},features:[],useObjects:true,spectralEnabled:false,analysisEngine:"esa-raster-manual-v1",profile:null,period:"ytd",createdAt};
 }
 function freshAnalysis(saved,fresh){
  return{...fresh,serverRevision:saved.serverRevision,acceptedResult:saved.acceptedResult,acceptedAt:saved.acceptedAt,acceptedAreas:saved.acceptedAreas,draftDirty:true};
 }
 root.DG_CREATE_SURFACE_REVIEW_RECORD=Object.freeze({create,freshAnalysis});
})(window);
