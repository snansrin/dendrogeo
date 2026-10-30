"use strict";

/* The field arrow is relative to the phone; the map remains north-up. */
(function(root){
  let lastView,compass=null,observedAt=0,sequence=0,permissionPending=false;
  const finite=value=>typeof value==="number"&&Number.isFinite(value);
  const normalize=angle=>(angle%360+360)%360;
  function paint(view){
    const{target,meters,targetBearing,getElement,translate}=view,arrow=getElement("navArrow");
    if(target&&!target.visited){
      getElement("navDist").textContent=Math.round(meters)+" m";
      const coords=view.gps;
      const heading=compass!=null&&Date.now()-observedAt<5000?compass:
        coords&&finite(coords.heading)&&finite(coords.speed)&&coords.speed>=0.8?coords.heading:null;
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
    const angle=root.screen?.orientation?.angle??root.orientation??0;
    let heading=null;
    if(finite(event.webkitCompassHeading)&&(!finite(event.webkitCompassAccuracy)||(event.webkitCompassAccuracy>=0&&event.webkitCompassAccuracy<=50)))heading=event.webkitCompassHeading;
    else if((event.absolute===true||event.type==="deviceorientationabsolute")&&finite(event.alpha))heading=360-event.alpha;
    if(heading==null)return;
    compass=normalize(heading+(finite(angle)?angle:0));observedAt=Date.now();
    const current=++sequence;
    if(lastView)paint(lastView);
    root.setTimeout?.(()=>{if(current===sequence&&lastView)paint(lastView);},5001);
  }
  async function start(){
    // iOS permission must be requested directly from the location button gesture.
    const sensor=root.DeviceOrientationEvent;
    if(!sensor?.requestPermission||permissionPending)return;
    permissionPending=true;
    try{await sensor.requestPermission();}catch(error){/* GPS/map remain available. */}
    finally{permissionPending=false;}
  }
  root.addEventListener?.("deviceorientationabsolute",orientation);
  root.addEventListener?.("deviceorientation",orientation);
  root.DG_RENDER_WAYPOINT_GPS_GUIDANCE_READOUT={render(view){lastView=view;paint(view);},start};
})(window);
