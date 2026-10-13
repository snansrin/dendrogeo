"use strict";

/* Record a user action in memory and immediately refresh transient presence. */
window.DG_RECORD_VISITOR_PRESENCE_ACTION={
 record(kind,detail,events,ping){
  try{
   events.recordAction(kind,detail);
   ping(null,true);
   return true;
  }catch(error){return false;}
 }
};
