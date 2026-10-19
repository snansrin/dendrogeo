"use strict";

/* Landing actions stay declarative in markup and keep legacy API receivers. */
(function(root){
  const handlers={
    "nav-toggle":()=>root.dgNavToggle(),
    "toggle-language":()=>root.dgToggleLang(),
    "show-auth":element=>root.showAuth(element.dataset.dgAuthMode||undefined),
    "guided-demo":()=>root.DG_GUIDED_MAP_DEMO?.start(),
    "google-sign-in":()=>root.dgGoogleSignIn(),
    "auth-tab":element=>root.authTab(element.dataset.dgAuthMode),
    login:()=>root.doLogin(),
    register:()=>root.doRegister(),
    "send-reset":()=>root.sendResetEmail()
  };
  function bind({document}){
    if(root._dgLandingActionsBound)return;
    root._dgLandingActionsBound=true;
    document.addEventListener("click",event=>{
      const element=event.target?.closest?.("[data-dg-landing-action]");
      if(!element)return;
      const handler=handlers[element.dataset.dgLandingAction];
      if(handler)handler(element);
    });
    document.addEventListener("submit",event=>{
      if(event.target?.matches?.("[data-dg-auth-form]"))event.preventDefault();
    });
  }
  root.DG_LANDING_ACTIONS=Object.freeze({bind});
})(window);

window.DG_LANDING_ACTIONS.bind({document});
