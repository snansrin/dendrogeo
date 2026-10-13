"use strict";
(function(root){
 function load({window,document,available,onLoad}){
  if(available){onLoad();return;}
  if(window._tsLoadStarted)return;
  window._tsLoadStarted=true;
  const script=document.createElement("script");
  script.src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
  script.onload=onLoad;
  script.onerror=()=>{window._tsLoadStarted=false;script.remove();};
  script.async=true;
  document.head.appendChild(script);
 }
 root.DG_TURNSTILE_SCRIPT_LOADER=Object.freeze({load});
})(window);
