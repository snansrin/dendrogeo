"use strict";

/* Preserve seasonal-window and scene order while tolerating a failed window. */
window.DG_FIND_SENTINEL_ANNUAL_SCENES={
  async find({windows,bbox,findRange}){
    const found=[];
    for(const windowRange of windows){
      let scenes=[];
      try{scenes=await findRange(bbox,windowRange.start,windowRange.end,windowRange.max);}catch(error){scenes=[];}
      for(const scene of scenes)found.push({window:windowRange,scene});
    }
    return found;
  }
};
