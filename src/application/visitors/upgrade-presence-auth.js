"use strict";

/* Upgrade an already-subscribed anon presence channel without blocking join. */
window.DG_UPGRADE_VISITOR_PRESENCE_AUTH={
 create(){
  return Object.freeze({async run(ports,generation,isCurrent){
   try{
    const{data}=await ports.getSession();
    const token=data?.session?.access_token;
    if(isCurrent(generation)&&token)await ports.setRealtimeAuth(token);
   }catch(e){}
  }});
 }
};
