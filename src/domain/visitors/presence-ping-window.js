"use strict";

/* Keep routine transient-presence pings at least ten seconds apart. */
window.DG_VISITOR_PRESENCE_PING_WINDOW=Object.freeze({
 shouldSend({force=false,now,lastSent=0,minimumInterval=10000}={}){
  return !!force||Number(now)-Number(lastSent)>=Number(minimumInterval);
 }
});
