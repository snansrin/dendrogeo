"use strict";

/* Derive a display-only collaborator marker without changing Presence payloads. */
window.DG_BUILD_PARK_LIVE_COLLABORATOR_VIEW={
  build({member,color,now,format}){
    const name=member.n||"?",age=Math.max(0,Math.round((now-(member.t||now))/1000));
    return{lat:member.la,lon:member.lo,name,initial:String(name).trim().slice(0,1).toLocaleUpperCase("tr-TR"),color:color(member.id),ageLabel:age<60?age+" "+format("sn"):Math.round(age/60)+" "+format("dk")};
  }
};
