"use strict";

/* Persist a drawn candidate when online, then refresh the active park card. */
window.DG_HANDLE_PARK_DRAWN={
  async handle(candidate,ports){
    let row=null;
    if(candidate&&ports.isOnline())row=await ports.register(candidate);
    else if(candidate)ports.notifyOffline();
    ports.setCandidate(candidate||null);
    ports.setPark(row||null);
    ports.renderCard();
    return row;
  }
};
