"use strict";

/* Start Presence immediately, guard callbacks by generation, and upgrade auth later. */
window.DG_START_VISITOR_PRESENCE_SESSION={
 start({state,client,user,sessionId,channelAdapter,authUpgrade,timers,emit,ping,stop,fail,getView}){
  try{
   if(!user||!client||typeof client.channel!=="function")return false;
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
   const channel=channelAdapter
    ?channelAdapter.open(client,String(user.id),sessionId,onSync)
    :client.channel("dg-presence",{config:{presence:{key:String(user.id)+":"+sessionId}}});
   state.channel=channel;
   if(channelAdapter)channelAdapter.subscribe(channel,onStatus);
   else{channel.on("presence",{event:"sync"},onSync);channel.subscribe(onStatus);}
   state.watchTimer=timers.setTimeout(()=>{if(generation===state.generation&&state.status==="connecting")fail("WATCHDOG");},20000);
   if(authUpgrade)authUpgrade.run(client,generation,value=>value===state.generation);
   else (async()=>{try{const{data}=await client.auth.getSession();const token=data?.session?.access_token;
    if(generation===state.generation&&token&&client.realtime?.setAuth)await client.realtime.setAuth(token);
   }catch(e){}})();
   return true;
  }catch(e){
   state.ready=false;state.status="error";emit();
   if(state.channel)fail("START");
   return false;
  }
 }
};
