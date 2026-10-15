"use strict";

/* Project-name preview and edit buttons remain presentation events. */
(function(root){
  const handlers={
    "preview-name":()=>root.dgProjectNamePreview(),
    save:()=>root.createProject(),
    cancel:()=>root.cancelProjectEdit()
  };
  function bind({document}){
    if(root._dgProjectEditActionsBound)return;
    root._dgProjectEditActionsBound=true;
    document.addEventListener("input",event=>{
      const element=event.target?.closest?.("[data-dg-project-action='preview-name']");
      if(element)handlers["preview-name"]();
    });
    document.addEventListener("click",event=>{
      const element=event.target?.closest?.("[data-dg-project-action]");if(!element)return;
      const action=element.dataset.dgProjectAction;if(action!=="preview-name"&&handlers[action])handlers[action]();
    });
  }
  root.DG_PROJECT_EDIT_ACTIONS=Object.freeze({bind});
})(window);

window.DG_PROJECT_EDIT_ACTIONS.bind({document});
