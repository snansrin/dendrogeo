"use strict";
/* Draw the reviewed surface and relative-NDVI layers on the verified GIS map. */
(function(root){
 function draw({context:g,layout,layers,sensitivity,record,tiers,ndviPolys,parkRings,holes,
  decisionCount,areas,parkName,classes,canvasApi,getLandcover,readProjectId,getGridCells,
  getWaypoints,getLastWaypoints,hasParkAreaHa,getParkAreaHa,getSurfaceTypes,formatArea,outline,color}){
  const {CW,CH}=layout;
  root.DG_GIS_EXPORT_VERIFIED_FRAME.drawHeader({g,CW,CH,parkName,decisionCount,sensitivity});
  const mapResult=root.DG_GIS_EXPORT_VERIFIED_LAYERS.draw({context:g,layout,layers,sensitivity,ndviPolys,parkRings,holes,
   canvasApi,getLandcover,readProjectId,getGridCells,getWaypoints,getLastWaypoints,classes,outline});
  if(!mapResult.ok)return mapResult;
  const parkHa=hasParkAreaHa()?getParkAreaHa():Object.values(areas).reduce((a,n)=>a+Number(n||0),0)/10000;
  root.DG_GIS_EXPORT_VERIFIED_SUMMARY.draw({g,CW,parkHa,decisionCount,areas,layers,tiers,classes,
   getSurfaceTypes,formatArea,color});
  root.DG_GIS_EXPORT_VERIFIED_FRAME.drawFooter({g,CW,CH,record});
  return{ok:true};
 }
 root.DG_GIS_EXPORT_VERIFIED_CANVAS=Object.freeze({draw});
})(window);
