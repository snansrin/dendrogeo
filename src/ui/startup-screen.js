"use strict";
/* Startup presentation owns no session, project or analysis data. */
(function(root){
 function finish(){const screen=document.getElementById("dgStartupScreen");if(screen)screen.hidden=true;}
 function dashboard({view="dash",setView}){
  const target=document.getElementById("v-"+view)?view:"dash";
  setView(target);
  document.querySelectorAll(".view").forEach(item=>item.classList.toggle("on",item.id==="v-"+target));
  document.querySelectorAll("#side .item").forEach(item=>item.classList.toggle("on",item.dataset.dgView===target));
  if(root.history)root.history.scrollRestoration="manual";
  finish();
 }
 root.DG_STARTUP_SCREEN=Object.freeze({finish,dashboard});
})(window);
