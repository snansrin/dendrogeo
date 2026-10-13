"use strict";

/* Publish a collaborator's ephemeral coordinates no more often than every 10s. */
window.DG_TRACK_PARK_LIVE_POSITION={
  ping({channel,live,enabled,gps,userId,name,lastPing,now,setLastPing}){
    try{
      if(!channel||!live||typeof channel.track!=="function"||!enabled||!gps||gps.latitude==null)return;
      if(now-lastPing<10000)return;
      setLastPing(now);
      return channel.track({id:String(userId),n:name||"?",la:gps.latitude,lo:gps.longitude,t:now});
    }catch(e){}
  }
};
