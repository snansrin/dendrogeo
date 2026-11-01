"use strict";

/* Orchestrate the existing project read, park channel transition, and subscription ports. */
window.DG_JOIN_LIVE_SHARE_PARK={
  async join({enabled,user,client,projectId,currentParkId,channel,resolve,readParkId,leave,setParkId,showConnecting,subscribe,onSync,onStatus,isCurrent=()=>true}){
    const input={enabled,hasUser:!!user,hasClient:!!client,projectId,parkResolved:false,currentParkId,hasChannel:!!channel};
    let plan=resolve(input);
    if(plan.action==="skip")return{status:"skipped"};
    if(plan.action==="leave"){leave();return{status:"left"};}
    const parkId=await readParkId(projectId);
    // A user can change the Waypoint project while the authorized park read
    // is pending. Never join or remove a newer project's Presence channel.
    if(!isCurrent())return{status:"stale"};
    plan=resolve({...input,parkId,parkResolved:true});
    if(plan.action==="leave"){leave();return{status:"left"};}
    if(plan.action==="reuse")return{status:"reused",parkId};
    leave();
    setParkId(plan.parkId);
    showConnecting();
    await subscribe({parkId:plan.parkId,userId:user.id,onSync,onStatus});
    return{status:"joined",parkId:plan.parkId};
  }
};
