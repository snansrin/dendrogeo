"use strict";

/* Subscribe to a park-scoped Presence channel before refreshing its JWT. */
window.DG_PARK_PRESENCE_CHANNEL_ADAPTER={
  join({client,parkId,userId,onSync,onStatus,setChannel,setWatch,getWatch,clearTimer,setTimer,onWatchdog,setAuth}){
    const channel=client.channel("dg-park-"+parkId,{config:{presence:{key:String(userId)}}});
    setChannel(channel);
    channel.on("presence",{event:"sync"},onSync);
    channel.subscribe(onStatus);
    if(getWatch())clearTimer(getWatch());
    setWatch(setTimer(onWatchdog,8000));
    void (async()=>{try{const{data}=await client.auth.getSession();const token=data&&data.session&&data.session.access_token;if(token)setAuth(token);}catch(e){}})();
    return channel;
  }
};
