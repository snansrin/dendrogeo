"use strict";

/* Phone-relative target readout and live north-referenced BLUE map location.
 * A GPS course is used only while moving; target bearing is never device heading. */
(function(root){
  let lastView,compass=null,observedAt=0,sequence=0,permissionPending=false,staleTimer=null;
  const finite=value=>typeof value==="number"&&Number.isFinite(value);
  const normalize=angle=>(angle%360+360)%360;
  function currentHeading(view){
    if(compass!=null&&Date.now()-observedAt<5000)return compass;
    const gps=view?.gps;
    return gps&&finite(gps.heading)&&finite(gps.speed)&&gps.speed>=0.8?normalize(gps.heading):null;
  }
  function paint(view){
    const {target,meters,targetBearing,getElement,translate}=view,arrow=getElement("navArrow");
    const heading=currentHeading(view);
    // The location arrow and cone are updated in place: never redraw waypoint pins.
    root.DG_CREATE_WAYPOINT_GPS_LOCATION_MARKER?.setHeading?.(heading);
    if(target&&!target.visited){
      getElement("navDist").textContent=Math.round(meters)+" m";
      const label=heading==null?translate("Pusula bekleniyor; konumu ve haritayı izleyin."):translate("Telefon yönüne göre");
      getElement("navTarget").textContent=translate("Hedef:")+" P"+target.wp_id+" · "+Math.round(targetBearing)+"° · "+label;
      arrow.style.transform="rotate("+(heading==null?0:normalize(targetBearing-heading))+"deg)";
      arrow.style.visibility=heading==null?"hidden":"visible";
      arrow.title=label;
      return;
    }
    getElement("navDist").textContent="—";
    getElement("navTarget").textContent=translate("Hedef seç / tamamlandı");
    arrow.style.transform="rotate(0)";
    arrow.style.visibility="hidden";
  }
  function orientation(event){
    const screenAngle=root.screen?.orientation?.angle??root.orientation??0;
    let heading=null;
    if(finite(event.webkitCompassHeading)&&(!finite(event.webkitCompassAccuracy)||(event.webkitCompassAccuracy>=0&&event.webkitCompassAccuracy<=50)))
      heading=event.webkitCompassHeading;
    else if((event.absolute===true||event.type==="deviceorientationabsolute")&&finite(event.alpha))
      heading=360-event.alpha;
    if(heading==null)return;
    compass=normalize(heading+(finite(screenAngle)?screenAngle:0));
    observedAt=Date.now();
    const current=++sequence;
    if(lastView)paint(lastView);
    if(staleTimer!=null)root.clearTimeout?.(staleTimer);
    staleTimer=root.setTimeout?.(()=>{if(current===sequence&&lastView)paint(lastView);},5001)??null;
  }
  async function start(){
    // Call synchronously from the GPS button click: iOS requires a user gesture.
    const sensor=root.DeviceOrientationEvent;
    if(!sensor?.requestPermission||permissionPending)return;
    permissionPending=true;
    try{await sensor.requestPermission();}catch(error){/* GPS/map remain available. */}
    finally{permissionPending=false;}
  }
  root.addEventListener?.("deviceorientationabsolute",orientation);
  root.addEventListener?.("deviceorientation",orientation);
  root.DG_RENDER_WAYPOINT_GPS_GUIDANCE_READOUT=Object.freeze({
    render(view){lastView=view;paint(view);},
    start
  });
})(window);
