"use strict";

/* Keep only other Presence members with usable coordinates, preserving sync order. */
window.DG_SELECT_PARK_LIVE_COLLABORATORS={
  select({presence,currentUserId}){
    const members=[];
    for(const key in presence||{})for(const member of presence[key]||[]){
      if(!member||String(member.id)===String(currentUserId)||member.la==null||member.lo==null)continue;
      members.push(member);
    }
    return members;
  }
};
