"use strict";
(function(root){
 function create(getClient){
  return Object.freeze({
   getSession(){return getClient().auth.getSession();},
   onAuthStateChange(callback){return getClient().auth.onAuthStateChange(callback);},
   setRealtimeAuth(token){const realtime=getClient().realtime;return realtime?.setAuth?realtime.setAuth(token):undefined;},
   signInWithPassword(credentials){return getClient().auth.signInWithPassword(credentials);},
   signUp(credentials){return getClient().auth.signUp(credentials);},
   resetPasswordForEmail(email,options){return getClient().auth.resetPasswordForEmail(email,options);},
   signOut(){return getClient().auth.signOut({scope:"local"});},
   updatePassword(password){return getClient().auth.updateUser({password});},
   updateProfileMetadata(profile){return getClient().auth.updateUser({data:{dendrogeo_profile:profile}});},
   signInWithOAuth(options){return getClient().auth.signInWithOAuth(options);},
   loadProfile(id){return getClient().from("profiles").select("*").eq("id",id).single();}
  });
 }
 root.DG_AUTH_SESSION_STORE=Object.freeze({create});
})(window);
