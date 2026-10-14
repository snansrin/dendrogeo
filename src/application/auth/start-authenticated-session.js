"use strict";
(function(root){
 function start({user,setUser,startShell,loadProfile,applyProfile,onProfileError}){
  if(!user?.id)return false;
  setUser(user);
  startShell();
  Promise.resolve().then(()=>loadProfile(user.id)).then(result=>{
   if(result?.error)throw result.error;
   applyProfile(result?.data||null);
  }).catch(error=>{if(onProfileError)onProfileError(error);});
  return true;
 }
 root.DG_START_AUTHENTICATED_SESSION=Object.freeze({start});
})(window);
