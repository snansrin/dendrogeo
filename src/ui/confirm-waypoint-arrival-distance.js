"use strict";

window.DG_CONFIRM_WAYPOINT_ARRIVAL_DISTANCE={
  confirm({target,gps,distance,confirm,format}){
    if(!gps)return true;
    const meters=distance(gps.latitude,gps.longitude,target.lat,target.lon);
    return meters<=50||confirm(format("Hedeften {d} m uzaktasın.\nYine de 'vardım' işaretlensin mi?",{d:meters.toFixed(0)}));
  }
};
