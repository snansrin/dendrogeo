"use strict";
/* Startup presentation owns no session, project or analysis data. */
(function(root){
 function finish(){const screen=document.getElementById("dgStartupScreen");if(screen)screen.hidden=true;}
 function dashboard({setView,saveView}){
  setView("dash");saveView("dash");
  document.querySelectorAll(".view").forEach(view=>view.classList.toggle("on",view.id==="v-dash"));
  document.querySelectorAll("#side .item").forEach((item,index)=>item.classList.toggle("on",index===0));
  try{localStorage.removeItem("dg_scroll_dash");localStorage.removeItem("dg_scrollw_dash");}catch(error){}
  if(root.history)root.history.scrollRestoration="manual";
  const main=document.getElementById("main");if(main)main.scrollTop=0;
  root.scrollTo({top:0,left:0,behavior:"instant"});
  finish();
 }
 root.DG_STARTUP_SCREEN=Object.freeze({finish,dashboard});
})(window);
