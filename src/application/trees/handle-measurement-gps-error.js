"use strict";

/* Preserve permission denial, one timeout retry, and actionable GPS errors. */
window.DG_HANDLE_MEASUREMENT_GPS_ERROR={
  handle(error,ports){
    if(error.code===1)return ports.showStatus("İzin reddedildi. iPhone: Ayarlar→Safari→Konum→Kullanırken İzin Ver.",true);
    if(error.code===3){
      try{return ports.retry(()=>ports.showStatus("GPS başarısız: dışarıda tekrar deneyin.",true));}
      catch(e){return ports.showStatus("GPS hatası.",true);}
    }
    return ports.showStatus("GPS hatası: "+error.message,true);
  }
};
