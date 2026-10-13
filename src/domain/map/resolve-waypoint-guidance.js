"use strict";
/* Resolve the established field guidance from target, GPS and GPS accuracy. */
(function(root){
  function resolve({target,gps,distance,translate}){
    if(!target||target.visited)return translate("Hedef seçerek navigasyona başlayın.");
    if(!gps)return translate("Hedef seçildi. Mesafe ve yön için konumu etkinleştirin.");
    const meters=distance(gps.latitude,gps.longitude,target.lat,target.lon);
    return meters<=gps.accuracy
      ?translate("Hedef GPS belirsizlik alanında. Noktayı sahada doğrulayın.")
      :meters<=50
        ?translate("Hedefe yaklaştınız. Noktayı doğrulayıp Vardım düğmesine basın.")
        :translate("Kesikli çizgi hedefe kuş uçuşu yönü gösterir; yürüyüş rotası değildir.");
  }
  root.DG_WAYPOINT_GUIDANCE=Object.freeze({resolve});
})(window);
