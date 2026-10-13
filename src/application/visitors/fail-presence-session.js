"use strict";

/* Mark a live channel error and schedule the existing bounded reconnect policy. */
window.DG_FAIL_VISITOR_PRESENCE_SESSION={
 fail(state,reason,{timers,emit,retryDelay,stop,start}){
  if(!state.channel||state.retryTimer)return false;
  timers.clearTimeout(state.watchTimer);timers.clearInterval(state.heartbeatTimer);
  state.watchTimer=state.heartbeatTimer=null;state.ready=false;state.status="error";emit(reason);
  const delay=retryDelay(state.retryCount++);
  state.retryTimer=timers.setTimeout(()=>{state.retryTimer=null;stop();start();},delay);
  return true;
 }
};
