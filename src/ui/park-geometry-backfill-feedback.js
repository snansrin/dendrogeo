"use strict";

/* Keep the existing park geometry backfill notifications at the UI boundary. */
(function(root){
  function create({toast,escape,format}){
    function notify(kind,park,error){
      if(kind==="loading")toast("🛰 OSM sınırı çekiliyor…","info","🛰");
      if(kind==="osm-error")toast(format("OSM hatası: ")+escape(error.message),"err","🛰");
      if(kind==="boundary-not-found")toast("OSM'de kapalı sınır bulunamadı (relation parçalı olabilir).","warn","🛰");
      if(kind==="write-error")toast(format("Yazılamadı (yetki/ağ): ")+escape(error.message),"err","🛰");
      if(kind==="saved")toast("✓ "+escape(park.name)+" geometrisi yazıldı — çit artık tam poligonla.","ok","🛰");
    }
    return Object.freeze({notify});
  }
  root.DG_PARK_GEOMETRY_BACKFILL_FEEDBACK=Object.freeze({create});
})(window);
