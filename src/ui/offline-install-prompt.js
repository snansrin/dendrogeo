"use strict";

/* Own the browser install-prompt lifecycle and its toolbar feedback. */
(function(root){
  let deferred=null;
  root.addEventListener("beforeinstallprompt",event=>{
    event.preventDefault();
    deferred=event;
    const button=root.document.getElementById('installBtn');
    if(button)button.style.display='';
  });
  async function install(){
    if(!deferred)return root.toast("Tarayıcı kurulum istemini göstermedi — menüden 'Ana ekrana ekle' deneyin.","warn","📲");
    deferred.prompt();
    const result=await deferred.userChoice.catch(()=>null);
    deferred=null;
    const button=root.document.getElementById('installBtn');
    if(button)button.style.display='none';
    if(result&&result.outcome==='accepted')root.toast("✓ Uygulama ana ekrana kuruluyor","ok","📲");
  }
  root.DG_OFFLINE_INSTALL_PROMPT=Object.freeze({install});
})(window);
