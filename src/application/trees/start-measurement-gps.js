"use strict";

/* Coordinate permission, first fix, live watch, presence and wake lock. */
window.DG_START_MEASUREMENT_GPS={
  async start(ports){
    const gps=ports.geolocation;
    if(!gps.isAvailable())return ports.showStatus("Tarayıcı konum desteklemiyor.",true);
    if(ports.isIOS())ports.showIOSHint();
    try{if(await gps.permissionState()==="denied")return ports.showStatus("Konum izni reddedildi. Ayarlar→Safari→Konum.",true);}catch(e){}

    ports.showStatus("Konum alınıyor…",false);
    ports.setBusy(true);
    const options={enableHighAccuracy:true,timeout:15000,maximumAge:0};
    const onFix=position=>{
      ports.setBusy(false);
      ports.setGPS(position.coords);
      ports.updateGPS();
      ports.liveSharePing();
      ports.presencePing();
      ports.acquireWakeLock();
      gps.watchPosition(next=>{
        ports.setGPS(next.coords);
        ports.updateGPS();
        ports.liveSharePing();
        ports.presencePing();
      },()=>{},{...options,maximumAge:1000});
    };
    const onError=error=>ports.handleError(error,{
      showStatus:ports.showStatus,
      retry:onRetryFailure=>{
        try{gps.getCurrentPosition(onFix,onRetryFailure,options);}
        catch(e){ports.showStatus("GPS hatası.",true);}
      }
    });
    try{gps.getCurrentPosition(onFix,onError,options);}
    catch(e){ports.showStatus("Konum başlatılamadı.",true);}
  }
};
