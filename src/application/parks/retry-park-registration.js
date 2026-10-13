"use strict";

/* Retry the existing park registration and keep its best-effort presence event. */
window.DG_RETRY_PARK_REGISTRATION={
  async retry(candidate,ports){
    if(!candidate){ports.notify("Önce park algıla","err","🌳");return null;}
    const row=await ports.register(candidate);
    if(!row)return null;
    ports.setPark(row);ports.renderCard();
    ports.notify(ports.successMessage(row),"ok","🌳");
    try{ports.recordPresence("park",row.name);}catch(e){}
    return row;
  }
};
