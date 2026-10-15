"use strict";

/* Delegate the persistent app-chrome controls to their existing services. */
(function(root){
 const handlers={
  install:()=>root.dgInstallApp(),
  "toggle-language":()=>root.dgToggleLang(),
  logout:()=>root.logout()
 };
 function bind({document}){
  if(root._dgShellChromeActionsBound)return;
  root._dgShellChromeActionsBound=true;
  document.addEventListener("click",event=>{
   const element=event.target?.closest?.('[data-dg-chrome-action]');
   const handler=element&&handlers[element.dataset.dgChromeAction];
   if(handler)handler(element);
  });
 }
 root.DG_SHELL_CHROME_ACTIONS=Object.freeze({bind});
})(window);

window.DG_SHELL_CHROME_ACTIONS.bind({document});
