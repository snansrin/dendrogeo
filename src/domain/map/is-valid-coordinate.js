"use strict";
/* Reject empty, out-of-range, non-finite, and Null Island coordinates. */
(function(root){
  function isValid(lat,lon){
    if(lat===null||lat===undefined||lat==="")return false;
    if(lon===null||lon===undefined||lon==="")return false;
    const latitude=Number(lat),longitude=Number(lon);
    if(!Number.isFinite(latitude)||!Number.isFinite(longitude))return false;
    if(latitude<-90||latitude>90||longitude<-180||longitude>180)return false;
    return !(latitude===0&&longitude===0);
  }
  root.DG_MAP_COORDINATE=Object.freeze({isValid});
})(window);
