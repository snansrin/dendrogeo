"use strict";

/* Start Presence immediately, guard callbacks by generation, and upgrade auth later. */
window.DG_START_VISITOR_PRESENCE_SESSION={
 start({state,user,sessionId,channelAdapter,authUpgrade,authPorts,timers,emit,ping,stop,fail,getView}){
  try{
   if(!user||!channelAdapter)return false;
   if(state.channel&&state.user===String(user.id))return false;
   if(state.channel)stop();
   const generation=++state.generation;
   state.user=String(user.id);state.status="connecting";emit();
   const onSync=()=>{if(generation===state.generation)emit();};
   const onStatus=status=>{
    if(generation!==state.generation)return;
    if(status==="SUBSCRIBED"){
     state.ready=true;state.status="on";state.retryCount=0;
     timers.clearTimeout(state.watchTimer);state.watchTimer=null;
     timers.clearInterval(state.heartbeatTimer);state.heartbeatTimer=timers.setInterval(()=>ping(null,true),30000);
     state.lastPing=0;ping(getView(),true);emit();
    }else if(status==="CHANNEL_ERROR"||status==="TIMED_OUT"||status==="CLOSED")fail(status);
   };
   const channel=channelAdapter.open(String(user.id),sessionId,onSync);
   state.channel=channel;
   channelAdapter.subscribe(channel,onStatus);
   state.watchTimer=timers.setTimeout(()=>{if(generation===state.generation&&state.status==="connecting")fail("WATCHDOG");},20000);
   if(authUpgrade&&authPorts)authUpgrade.run(authPorts,generation,value=>value===state.generation);
   return true;
  }catch(e){
   state.ready=false;state.status="error";emit();
   if(state.channel)fail("START");
   return false;
  }
 }
};
