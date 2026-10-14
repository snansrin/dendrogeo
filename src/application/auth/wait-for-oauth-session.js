"use strict";
(function(root){
 function wait(ports,timeoutMs,timers){
  const ms=Number(timeoutMs)||7000;
  const set=(timers&&timers.setTimeout)||setTimeout;
  const clear=(timers&&timers.clearTimeout)||clearTimeout;
  return new Promise(resolve=>{
   let done=false,sub=null,timeout=null;
   const finish=session=>{
    if(done)return;
    done=true;
    if(timeout)clear(timeout);
    try{if(sub&&sub.subscription&&sub.subscription.unsubscribe)sub.subscription.unsubscribe();}catch(e){}
    resolve(session||null);
   };
   try{
    const r=ports.onAuthStateChange((event,session)=>{
     if((event==="SIGNED_IN"||event==="USER_UPDATED"||event==="TOKEN_REFRESHED"||event==="INITIAL_SESSION")&&session)finish(session);
    });
    sub=(r&&r.data)||null;
   }catch(e){}
   try{
    Promise.resolve(ports.getSession()).then(r=>{
     const session=r&&r.data?r.data.session:null;
     if(session)finish(session);
    }).catch(()=>{});
   }catch(e){}
   timeout=set(()=>finish(null),ms);
  });
 }
 root.DG_AUTH_OAUTH_SESSION=Object.freeze({wait});
})(window);
