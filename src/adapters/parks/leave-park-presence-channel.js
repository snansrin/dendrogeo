"use strict";

/* Remove an ephemeral park channel and its local Leaflet layer safely. */
window.DG_LEAVE_PARK_PRESENCE_CHANNEL={
  leave({channel,client,layer,map,setChannel,setParkId,setLayer,note}){
    try{if(channel&&client&&client.removeChannel)client.removeChannel(channel);}catch(e){}
    setChannel(null);setParkId(0);
    if(layer&&map){try{map.removeLayer(layer);}catch(e){}}
    setLayer(null);if(note)note.textContent="";
  }
};
