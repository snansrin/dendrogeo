"use strict";
(function(root){
 function wait(client,timeoutMs,timers){
  const ms=Number(timeoutMs)||9000;
  const set=(timers&&timers.setTimeout)||setTimeout;
  const clear=(timers&&timers.clearTimeout)||clearTimeout;
  return new Promise(resolve=>{
   let done=false,sub=null,grace=null;
   const finish=session=>{
    if(done)return;
    done=true;
    if(grace)clear(grace);
    try{if(sub&&sub.subscription&&sub.subscription.unsubscribe)sub.subscription.unsubscribe();}catch(e){}
    resolve(session||null);
   };
   try{
    const r=client.auth.onAuthStateChange((event,session)=>{
     if(event==="SIGNED_IN"||event==="USER_UPDATED"){finish(session);return;}
     if(event==="INITIAL_SESSION"){
      if(session){finish(session);return;}
      if(!grace)grace=set(()=>finish(null),1500);
     }
    });
    sub=(r&&r.data)||null;
   }catch(e){}
   try{
    Promise.resolve(client.auth.getSession()).then(r=>{
     const session=r&&r.data?r.data.session:null;
     if(session)finish(session);
    }).catch(()=>{});
   }catch(e){}
   set(()=>finish(null),ms);
  });
 }
 root.DG_AUTH_OAUTH_SESSION=Object.freeze({wait});
})(window);
