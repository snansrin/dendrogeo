"use strict";

/* Build the bounded, transient visitor payload sent through Realtime Presence. */
window.DG_VISITOR_PRESENCE_PAYLOAD={
 build({user,profile,view,now,gps,sid,sessionStart,deviceTag,events,hidden}){
  const payload={id:String(user.id),
   n:(profile&&(profile.full_name||profile.email))||"?",
   r:(profile&&profile.role)||"user",v:view||"dash",t:now};
  if(gps&&gps.latitude!=null){payload.la=gps.latitude;payload.lo=gps.longitude;
   events.recordLocation(payload.la,payload.lo,now);
  }
  payload.sid=sid;payload.st=sessionStart;payload.dev=deviceTag;
  const{views,lastAction,locations}=events.snapshot();
  if(views.length)payload.vh=views;
  if(lastAction)payload.act=lastAction;
  if(payload.la!=null&&locations.length>1)payload.lh=locations;
  payload.hidden=!!hidden;
  return payload;
 }
};
