"use strict";

/* Keep shell navigation markup declarative and preserve click/keyboard behavior. */
(function(root){
  function bind({document,navigate}){
    if(root._dgShellNavActionsBound)return;
    root._dgShellNavActionsBound=true;
    const itemFrom=target=>target&&typeof target.closest==="function"?target.closest("[data-dg-view]"):null;
    document.addEventListener("click",event=>{
      const item=itemFrom(event.target);if(item)navigate(item.dataset.dgView);
    });
    document.addEventListener("keydown",event=>{
      if(event.key!=="Enter"&&event.key!==" ")return;
      const item=itemFrom(event.target);if(!item)return;
      event.preventDefault();navigate(item.dataset.dgView);
    });
  }
  root.DG_SHELL_NAV_ACTIONS=Object.freeze({bind});
})(window);

window.DG_SHELL_NAV_ACTIONS.bind({document,navigate:view=>window.go(view)});
