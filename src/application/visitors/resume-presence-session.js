"use strict";

/* Reconnect a missing session after resume, otherwise publish a fresh heartbeat. */
window.DG_RESUME_VISITOR_PRESENCE_SESSION={
 resume({user,ready,stop,start,ping}){
  if(!user)return false;
  if(!ready){stop();start();}else ping(null,true);
  return true;
 }
};
