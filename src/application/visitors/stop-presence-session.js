"use strict";

/* Invalidate callbacks, clear presence timers, and dispose of the active channel. */
window.DG_STOP_VISITOR_PRESENCE_SESSION={
 stop(state,timers,removeChannel){
  state.generation++;
  timers.clearTimeout(state.retryTimer);timers.clearTimeout(state.watchTimer);timers.clearInterval(state.heartbeatTimer);
  state.retryTimer=state.watchTimer=state.heartbeatTimer=null;
  const old=state.channel;
  state.channel=null;state.user=null;state.ready=false;state.status="idle";
  if(old)removeChannel(old);
 }
};
