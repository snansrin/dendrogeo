"use strict";

/* Suggest the nearest unvisited waypoint or the next sequential point id. */
window.DG_SUGGEST_NEXT_MEASUREMENT_POINT=(()=>{
  let requestSequence=0;
  const current=(request,projectId,ports)=>request===requestSequence&&ports.canSuggest(projectId);
  return{
    async suggest(ports){
      const request=++requestSequence;
      if(!ports.canStart())return;
      const projectId=ports.projectId();
      if(!projectId||ports.pointValue())return;
      try{
        const gps=ports.gps();
        if(gps){
          const waypoints=await ports.fetchWaypoints(projectId);
          if(waypoints.length){
            const nearest=waypoints.sort((a,b)=>ports.distance(gps.latitude,gps.longitude,a.lat,a.lon)-ports.distance(gps.latitude,gps.longitude,b.lat,b.lon))[0];
            if(current(request,projectId,ports))ports.setPoint(nearest.wp_id);
            return;
          }
        }
        const latest=await ports.fetchLatest(projectId);
        if(current(request,projectId,ports))ports.setPoint(latest?(latest.point_id||0)+1:1);
      }catch(error){}
    }
  };
})();
