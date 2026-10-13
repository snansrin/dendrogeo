"use strict";

/* Query one project point and discard a response after either field changes. */
window.DG_QUERY_MEASUREMENT_POINT={
  async query({projectId,pointId,resolve,read,isCurrent,hide,render}){
    const target=resolve(projectId,pointId);
    if(!target){hide();return;}
    const record=await read(target);
    if(!isCurrent(target))return;
    return render(record,target.pointId);
  }
};
