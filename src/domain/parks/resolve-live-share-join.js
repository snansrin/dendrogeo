"use strict";

/* Resolve whether the current user should read, leave, reuse, or join a park channel. */
window.DG_RESOLVE_LIVE_SHARE_JOIN={
  resolve({enabled,hasUser,hasClient,projectId,parkId,parkResolved,currentParkId,hasChannel}){
    if(!enabled||!hasUser||!hasClient)return{action:"skip"};
    if(!projectId)return{action:"leave"};
    if(!parkResolved)return{action:"read-park"};
    if(!parkId)return{action:"leave"};
    if(currentParkId===parkId&&hasChannel)return{action:"reuse"};
    return{action:"join",parkId};
  }
};
