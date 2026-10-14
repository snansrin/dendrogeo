"use strict";

/* Load dashboard data on entry to its view instead of during every login. */
(function(root){
  function create({loadProjects,loadWaypoints,loadDashboard,loadRecords,loadWorld,loadMyRequests,loadRequestOptions}){
    const inFlight=new Map();
    function once(key,work){
      if(inFlight.has(key))return inFlight.get(key);
      const task=Promise.resolve().then(work).finally(()=>{if(inFlight.get(key)===task)inFlight.delete(key);});
      inFlight.set(key,task);return task;
    }
    return Object.freeze({
      start(){
        void once("dashboard",loadDashboard).catch(error=>console.warn("DENDROGEO · gösterge paneli yüklenemedi:",error?.message||error));
        return once("projects",loadProjects).catch(error=>{console.warn("DENDROGEO · projeler yüklenemedi:",error?.message||error);return null;});
      },
      load(view){
        if(view==="dash")return once("waypoints",loadWaypoints).then(()=>once("dashboard",loadDashboard));
        if(view==="nav")return once("waypoints",loadWaypoints);
        if(view==="records")return once("records",loadRecords);
        if(view==="world")return once("world",loadWorld);
        if(view==="export")return Promise.allSettled([once("my-requests",loadMyRequests),once("request-options",loadRequestOptions)]);
        return Promise.resolve();
      }
    });
  }
  root.DG_SHELL_VIEW_DATA=Object.freeze({create});
})(window);
