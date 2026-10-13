"use strict";

/* Remove an obsolete Realtime channel without leaking cleanup rejections. */
window.DG_VISITOR_REMOVE_PRESENCE_CHANNEL={
 create(){
  return Object.freeze({remove(client,channel){
   if(!client||!channel||typeof client.removeChannel!=="function")return;
   try{Promise.resolve(client.removeChannel(channel)).catch(()=>{});}catch(e){}
  }});
 }
};
