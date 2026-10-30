"use strict";

/* Coordinate confirmation, RLS-backed deletion, and project-list refresh. */
window.DG_DELETE_MEASUREMENT_PROJECT={
  async remove(projectId,ports){
    const count=await ports.count(projectId);
    if(!await ports.confirm(count))return{deleted:false};
    await ports.delete(projectId);
    ports.refresh();
    return{deleted:true};
  }
};
