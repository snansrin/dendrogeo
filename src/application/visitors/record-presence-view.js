"use strict";

/* Add a changed view to the bounded transient session, then publish it. */
window.DG_RECORD_VISITOR_PRESENCE_VIEW={
 record(view,events,ping){
  try{
   if(!events.recordView(view))return false;
   ping(view,true);
   return true;
  }catch(error){return false;}
 }
};
