"use strict";
(function(root){
 async function start(ports){
  ports.setButtonDisabled(true);
  ports.showMessage("Google'a yönlendiriliyorsun…",false);
  ports.showWait("🔵 Google'a yönlendiriliyorsun…");
  const redirectTo=ports.redirectTo();
  let error=null;
  try{
   const result=await ports.signIn({provider:"google",options:{redirectTo,queryParams:{prompt:"select_account"}}});
   error=result&&result.error?result.error:null;
  }catch(caught){error=caught;}
  if(!error)return{status:"redirecting"};
  ports.setButtonDisabled(false);
  ports.hideWait();
  const detail=String(error.message||error);
  const message=/provider.*not|disabled|not enabled/i.test(detail)
   ?"Google girişi bu projede henüz etkin değil. Supabase → Authentication → Providers → Google → Enable (bkz. docs/google-giris.md)."
   :"Google girişi başlatılamadı: "+detail;
  ports.showMessage(message,true);
  return{status:"failed",error,message};
 }
 root.DG_START_GOOGLE_SIGN_IN=Object.freeze({start});
})(window);
