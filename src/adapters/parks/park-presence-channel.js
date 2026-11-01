"use strict";

/* Join a park-scoped private Presence channel only after installing the session JWT. */
window.DG_PARK_PRESENCE_CHANNEL_ADAPTER={
  presence({channel}){return channel?channel.presenceState():{};},
  remove({client,channel}){
    try{if(channel&&client?.removeChannel)client.removeChannel(channel);}catch(e){}
  },
  async join({client,parkId,userId,onSync,onStatus,setChannel,setWatch,getWatch,clearTimer,setTimer,onWatchdog,isCurrent=()=>true}){
    try{
    const{data}=await client.auth.getSession();
    const token=data?.session?.access_token;
    if(!token||!client.realtime?.setAuth)throw new Error("Realtime authentication unavailable");
    await client.realtime.setAuth(token);
    // Do not attach an obsolete subscription after a project switch or opt-out.
    if(!isCurrent())return null;
    const channel=client.channel("dg-park-"+parkId,{config:{private:true,presence:{key:String(userId)}}});
    setChannel(channel);
    channel.on("presence",{event:"sync"},onSync);
    // Arm before subscribe: a synchronous SUBSCRIBED must clear this timer.
    if(getWatch())clearTimer(getWatch());
    setWatch(setTimer(()=>{if(isCurrent())onWatchdog();},20000));
    channel.subscribe(status=>{if(isCurrent())onStatus(status);});
    return channel;
    }catch(error){if(isCurrent())onStatus("CHANNEL_ERROR");return null;}
  }
};
