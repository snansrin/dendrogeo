"use strict";

/* Preserve the form's existing truthy project/point query gate. */
window.DG_RESOLVE_MEASUREMENT_POINT_QUERY={
  resolve(projectId,pointId){
    const project=Number(projectId),point=Number(pointId);
    if(!project||!point)return null;
    return{projectId:project,pointId:point};
  }
};
