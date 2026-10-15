"use strict";

/* Own admin-panel refresh and disclosure controls, keeping workflows in services. */
(function(root){
 function bind({document}){
  if(root._dgAdminPanelActionsBound)return;
  root._dgAdminPanelActionsBound=true;
  document.addEventListener("click",event=>{
   const element=event.target?.closest?.("[data-dg-admin-panel-action]");if(!element)return;
   switch(element.dataset.dgAdminPanelAction){
    case "reload-parks":root.loadParkAdmin();break;
    case "reload-publish-queue":root.dgLoadPublishQueue();break;
    case "toggle-closed-requests":{
     const body=document.getElementById(element.getAttribute("aria-controls"));if(!body)return;
     const expanded=element.getAttribute("aria-expanded")==="true";
     body.style.display=expanded?"none":"block";
     element.setAttribute("aria-expanded",String(!expanded));
     break;
    }
   }
  });
 }
 root.DG_ADMIN_PANEL_ACTIONS=Object.freeze({bind});
})(window);

window.DG_ADMIN_PANEL_ACTIONS.bind({document});
