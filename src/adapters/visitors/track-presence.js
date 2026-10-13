"use strict";

/* Send ephemeral state over the active Realtime channel and reject stale errors. */
window.DG_VISITOR_TRACK_PRESENCE={
 create(){
  return Object.freeze({send(channel,payload,generation,isCurrent,onFailure){
   try{
    Promise.resolve(channel.track(payload)).then(status=>{
     if(isCurrent(generation)&&status!=="ok")onFailure("TRACK");
    }).catch(()=>{if(isCurrent(generation))onFailure("TRACK");});
   }catch(e){if(isCurrent(generation))onFailure("TRACK");}
  }});
 }
};
