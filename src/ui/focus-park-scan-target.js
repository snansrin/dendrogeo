"use strict";
/* Focus discovery on project measurements, falling back to the user's GPS. */
(function(root){
  async function focus(projectId,ports){
    const map=ports.map();
    if(!map)return;
    if(projectId){
      try{
        const result=await ports.readProjectMeasurements(projectId);
        const points=(result&&result.data||[]).filter(row=>Number.isFinite(+row.lat)&&Number.isFinite(+row.lon));
        if(points.length){map.fitBounds(ports.bounds(points.map(row=>[+row.lat,+row.lon])).pad(.4),{maxZoom:17});return;}
      }catch(error){}
    }
    const gps=ports.gps();
    if(gps&&Number.isFinite(+gps.latitude))map.setView([gps.latitude,gps.longitude],17);
  }
  root.DG_FOCUS_PARK_SCAN_TARGET=Object.freeze({focus});
})(window);
