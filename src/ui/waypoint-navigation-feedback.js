"use strict";

/* Keep target-action notices and optional GPS activation in the UI boundary. */
window.DG_WAYPOINT_NAVIGATION_FEEDBACK_UI={
  gpsRequired({translate,notify,startGps}){
    notify(translate("En yakın noktayı seçmek için önce konumu etkinleştirin."),"warn","📡");
    try{startGps();}catch(error){}
  },
  noPending({translate,notify}){
    notify(translate("Bekleyen ölçüm noktası kalmadı."),"info");
  }
};
