"use strict";
/* Session and OAuth operations are ports; no SDK or platform state is owned here. */
window.DG_RESOLVE_SHELL_SESSION={async resolve({isOAuth,getOAuthError,showOAuthWait,waitOAuth,cleanOAuth,hideOAuth,getSession,initialHash}){
 let session=null;
 if(isOAuth?.()){
  const error=getOAuthError?.();if(error)return{status:'oauth-error',error};showOAuthWait();session=await waitOAuth();cleanOAuth?.();hideOAuth?.();if(!session)return{status:'oauth-missing'};
 }else{const response=await getSession();session=response?.data?.session||null;}
 const recovery=/type=recovery/.test(initialHash);return{status:session?(recovery?'recovery':'authenticated'):(recovery?'recovery-missing':'anonymous'),session};
}};
