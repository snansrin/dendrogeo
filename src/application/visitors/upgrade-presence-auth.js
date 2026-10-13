"use strict";

/* Upgrade an already-subscribed anon presence channel without blocking join. */
window.DG_UPGRADE_VISITOR_PRESENCE_AUTH={
 create(){
  return Object.freeze({async run(client,generation,isCurrent){
   try{
    const{data}=await client.auth.getSession();
    const token=data?.session?.access_token;
    if(isCurrent(generation)&&token&&client.realtime?.setAuth)await client.realtime.setAuth(token);
   }catch(e){}
  }});
 }
};
