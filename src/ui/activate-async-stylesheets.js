"use strict";

/* Enable preloaded non-blocking styles after the first paint without inline handlers. */
(function(root){
 function activate({document,requestAnimationFrame,setTimeout}){
  const links=document.querySelectorAll('link[data-dg-async-stylesheet][media="print"]');
  const apply=()=>links.forEach(link=>{link.media="all";});
  if(requestAnimationFrame)requestAnimationFrame(apply);
  else setTimeout(apply,16);
 }
 root.DG_ASYNC_STYLESHEETS=Object.freeze({activate});
})(window);

window.DG_ASYNC_STYLESHEETS.activate({document,requestAnimationFrame:window.requestAnimationFrame?.bind(window),setTimeout:window.setTimeout?.bind(window)});
