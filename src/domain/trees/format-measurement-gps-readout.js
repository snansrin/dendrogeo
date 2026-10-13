"use strict";

/* Resolve the established GPS accuracy labels and CSS states from a fix. */
window.DG_FORMAT_MEASUREMENT_GPS_READOUT={
  format(coords){
    const accuracy=coords.accuracy;
    const quality=accuracy<10?"ÇOK İYİ":accuracy<20?"İYİ":accuracy<40?"ORTA":"ZAYIF";
    return Object.freeze({accuracy:accuracy.toFixed(0),latitude:coords.latitude.toFixed(6),longitude:coords.longitude.toFixed(6),altitude:Number.isFinite(coords.altitude)?coords.altitude.toFixed(0)+" m":"—",quality,ringClass:"gpsring "+(accuracy<10?"good":accuracy<30?"mid":"bad"),badgeText:"GPS aktif · ±"+Math.round(accuracy)+" m · "+quality,badgeClass:"dg-png-badge"+(accuracy<20?"":accuracy<40?" amber":" red")});
  }
};
