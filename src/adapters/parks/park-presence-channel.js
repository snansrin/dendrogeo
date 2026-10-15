"use strict";

/* Subscribe to a park-scoped Presence channel before refreshing its JWT. */
window.DG_PARK_PRESENCE_CHANNEL_ADAPTER={
  presence({channel}){return channel?channel.presenceState():{};},
  remove({client,channel}){
    try{if(channel&&client?.removeChannel)client.removeChannel(channel);}catch(e){}
  },
  join({client,parkId,userId,onSync,onStatus,setChannel,setWatch,getWatch,clearTimer,setTimer,onWatchdog}){
    const channel=client.channel("dg-park-"+parkId,{config:{presence:{key:String(userId)}}});
    setChannel(channel);
    channel.on("presence",{event:"sync"},onSync);
    channel.subscribe(onStatus);
    if(getWatch())clearTimer(getWatch());
    setWatch(setTimer(onWatchdog,8000));
    void (async()=>{try{const{data}=await client.auth.getSession();const token=data&&data.session&&data.session.access_token;if(token&&client.realtime?.setAuth)client.realtime.setAuth(token);}catch(e){}})();
    return channel;
  }
};
