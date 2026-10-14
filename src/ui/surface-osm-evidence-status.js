"use strict";
(function(root){
 function text(record,translate){return record?.useObjects!==false&&record?.osmCoverage&&record.osmCoverage.status!=="complete"?translate("OSM bina, yol ve su verisi eksik. OSM destekli sonucu kabul etmeden önce Yeniden Tara ile veriyi tamamlayın."):"";}
 root.DG_SURFACE_OSM_EVIDENCE_STATUS=Object.freeze({text});
})(window);
