"use strict";

/* Resolve the selected project without coupling the park flow to the DOM. */
window.DG_SELECT_PARK_PROJECT={
  resolve(value,projects){
    const id=+value;
    if(!id)return null;
    return (projects||[]).find(project=>project.id===id)||null;
  }
};
