"use strict";

/* Keep Supabase Realtime channel setup behind a small visitor adapter. */
window.DG_VISITOR_PRESENCE_CHANNEL_ADAPTER={
 create(getClient){
  return Object.freeze({
   open(userId,sessionId,onSync){
    const client=getClient();
    const channel=client.channel("dg-presence",{config:{presence:{key:String(userId)+":"+sessionId}}});
    channel.on("presence",{event:"sync"},onSync);
    return channel;
   },
   subscribe(channel,onStatus){channel.subscribe(onStatus);}
  });
 }
};
