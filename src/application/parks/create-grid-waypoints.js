"use strict";
/* Persist a prepared grid waypoint batch after rechecking its asynchronous context. */
(function(root){
  function create({confirmBatch,fetchLatest,isCurrent,getUserId,prepareBatch,setLastRows,insert}){
    return async function createGridWaypoints({source,park,projectId,targetCells}){
      if(targetCells.length>500&&!confirmBatch(targetCells.length))return{status:"cancelled"};
      const {data:latest}=await fetchLatest(projectId);
      if(!isCurrent({source,park,projectId}))return{status:"stale"};
      const batch=prepareBatch(targetCells,latest,getUserId(),projectId);
      const rows=batch.rows,first=batch.firstWpId,next=first+rows.length;
      setLastRows(rows);
      const {error}=await insert(rows);
      if(error)return{status:"write-failed",error};
      return{status:"created",rows,first,next};
    };
  }
  root.DG_GRID_WAYPOINT_CREATE_APPLICATION=Object.freeze({create});
})(window);
