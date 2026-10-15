"use strict";

/* Install the signed-in token before joining a private presence channel. */
window.DG_UPGRADE_VISITOR_PRESENCE_AUTH={
 create(){
  return Object.freeze({async run(ports,generation,isCurrent){
   try{
    const{data}=await ports.getSession();
    const token=data?.session?.access_token;
    if(!token||!isCurrent(generation))return false;
    await ports.setRealtimeAuth(token);
    return isCurrent(generation);
   }catch(e){return false;}
  }});
 }
};
