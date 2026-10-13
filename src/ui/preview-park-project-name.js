"use strict";
/* Update the existing project-name preview from the active park and label. */
(function(root){
  function update(element,label,park,candidate,projectName){
    if(!element||!label)return false;
    const active=park||candidate;
    element.textContent=projectName((active&&active.name)||"",label.value||"");
    return true;
  }
  root.DG_PREVIEW_PARK_PROJECT_NAME=Object.freeze({update});
})(window);
