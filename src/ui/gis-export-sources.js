/* Read-only source adapters for standard and verified GIS PNG renderers. */
(function(root){
 "use strict";
 function create({getLandcover,getGridSession,hasWaypoints,getWaypoints,getLastWaypoints,getParkAreaFunction,getSurfaceTypes,readProjectId}){
  function standard(){return {getLandcover,
   getGridCells:getGridSession()!==undefined?()=>getGridSession().getCells():null,
   getWaypoints:hasWaypoints()?getWaypoints:null
  };}
  function verified(){return {getLandcover,readProjectId,
   getGridCells:()=>getGridSession()!==undefined?getGridSession().getCells()||[]:null,
   getWaypoints:()=>hasWaypoints()?getWaypoints():[],getLastWaypoints,
   hasParkAreaHa:()=>typeof getParkAreaFunction()==="function",
   getParkAreaHa:()=>getParkAreaFunction()(),getSurfaceTypes
  };}
  return Object.freeze({standard,verified});
 }
 root.DG_GIS_EXPORT_SOURCES=Object.freeze({create});
})(window);
