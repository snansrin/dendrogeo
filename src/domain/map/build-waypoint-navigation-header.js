"use strict";

/* Describe only the header state; GPS map guidance owns live distance/bearing. */
window.DG_BUILD_WAYPOINT_NAVIGATION_HEADER={
  build({gps,target}){
    return{
      gps,
      resetGuidance:!gps,
      targetText:!gps?(target?"Hedef: P"+target.wp_id:"Listeden veya haritadan hedef seçin."):null,
      gpsText:gps
        ?"GPS doğruluğu: "+(Number.isFinite(gps.accuracy)?"±"+Math.round(gps.accuracy)+" m":"bilinmiyor")
        :"GPS konumu bekleniyor; hedef seçebilirsiniz."
    };
  }
};
