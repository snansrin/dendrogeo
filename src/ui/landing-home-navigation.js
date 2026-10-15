"use strict";
/* Logo navigation reuses public landing entry; returning preserves the current app view. */
(function(root){
 function bind(document){let prior=null;
  document.addEventListener('click',event=>{
   const home=event.target.closest?.('[data-dg-home]'),back=event.target.closest?.('[data-dg-return-workspace]');
   if(!home&&!back||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||event.button>0)return;
   const shell=document.getElementById('shell'),landing=document.getElementById('landing'),returnButton=document.querySelector('[data-dg-return-workspace]');
   if(home&&typeof root.initLanding==='function'){
    event.preventDefault();if(shell&&(root.getComputedStyle?root.getComputedStyle(shell).display:shell.style.display)!=='none')prior={scroll:root.scrollY,display:shell.style.display||'block'};
    root.initLanding();if(returnButton)returnButton.hidden=!prior;root.scrollTo({top:0,behavior:'instant'});
   }else if(back&&prior){event.preventDefault();landing.style.display='none';shell.style.display=prior.display;root.scrollTo({top:prior.scroll,behavior:'instant'});}
  });
 }
 root.DG_LANDING_HOME_NAVIGATION=Object.freeze({bind});if(typeof document!=='undefined')bind(document);
})(window);
