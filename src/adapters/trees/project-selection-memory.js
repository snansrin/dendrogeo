"use strict";

/* Device-local last-project preference; it is never written to the server. */
window.DG_PROJECT_SELECTION_MEMORY={
  remember(storage,key,id){try{if(id)storage.setItem(key,String(id));}catch(error){}},
  restore(storage,key,projects){
    let last=null;try{last=storage.getItem(key);}catch(error){}
    if(!last||(projects||[]).every(project=>String(project.id)!==last))return null;
    if((projects||[]).some(project=>String(project.id)===last&&project.is_locked===true))return null;
    return last;
  }
};
