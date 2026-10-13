"use strict";

window.DG_SCHEDULE_MEASUREMENT_MARKER_CHUNKS={
  schedule({map,rows,chunk,token,createMarker,setTimer}){
    let index=0;
    (function step(){
      if(token!==map._markerToken)return;
      const end=Math.min(index+chunk,rows.length);
      for(;index<end;index++)map._cluster.addLayer(createMarker(rows[index]));
      if(index<rows.length)setTimer(step,16);
    })();
  }
};
