"use strict";
/* Read a one-shot high-accuracy GPS position using the established freshness window. */
(function(root){
  function read({navigator:device,maximumAgeSeconds,defaultMaximumAgeSeconds,now=Date.now}){
    return new Promise((resolve,reject)=>{
      if(!device||!("geolocation" in device))return reject({code:"unavailable",message:"Cihazda konum servisi yok"});
      device.geolocation.getCurrentPosition(
        position=>resolve({lat:position.coords.latitude,lon:position.coords.longitude,acc:position.coords.accuracy,at:now()}),
        error=>reject({code:error.code===1?"denied":(error.code===3?"timeout":"unavailable"),message:error.message||("kod "+error.code)}),
        {enableHighAccuracy:true,timeout:15000,maximumAge:(Number.isFinite(+maximumAgeSeconds)?+maximumAgeSeconds:defaultMaximumAgeSeconds)*1000}
      );
    });
  }
  root.DG_FRESH_GPS_FIX=Object.freeze({read});
})(window);
