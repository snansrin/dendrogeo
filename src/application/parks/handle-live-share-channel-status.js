"use strict";

/* Preserve subscription success, watchdog cleanup, initial ping, and failure handling order. */
window.DG_HANDLE_LIVE_SHARE_CHANNEL_STATUS={
  handle(status,{getWatch,setWatch,clearTimer,setLive,setLastPing,onConnected=()=>{},ping,draw,fail}){
    if(status==="SUBSCRIBED"){
      const watch=getWatch();
      if(watch){clearTimer(watch);setWatch(null);}
      setLive(true);
      setLastPing(0);
      onConnected();
      ping();
      draw();
      return;
    }
    if(status==="CHANNEL_ERROR"||status==="TIMED_OUT"||status==="CLOSED")fail();
  }
};
