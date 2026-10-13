"use strict";

/* Mark a project after its first automatic park-scan redirect for this tab. */
window.DG_PARK_SCAN_REDIRECT_MEMORY={
  wasRedirectedOrMark(projectId,getStorage){
    const key="dg_park_scan_"+projectId;
    try{
      const storage=getStorage();
      if(storage.getItem(key))return true;
      storage.setItem(key,"1");
      return false;
    }catch(e){return true;}
  }
};
