"use strict";
/*
 * DendroGeo saha ölçüm protokolü — DEĞİŞTİRİLEMEZ KİLİT.
 *
 * measurements.dbh_cm tarihsel kolon adı korunur; fakat bu kolon saha
 * ekibinin mezura ile 1,30 m yükseklikte ölçtüğü GÖVDE ÇEVRESİNİ (cm) taşır.
 * Allometriye doğrudan verilmez. Önce:
 *
 *   DBH çapı [cm] = göğüs çevresi [cm] / π
 *
 * dönüşümü uygulanır. Karbon, biyokütle, hacim, QA, rapor ve dışa aktarım
 * motorlarının tamamı bu tek protokole bağlıdır.
 */
const DG_MEASUREMENT_PROTOCOL_PAYLOAD=Object.freeze({
 allometry_input:"derived_diameter_cm",
 diameter_conversion:"diameter_cm=circumference_cm/pi",
 max_circumference_cm:1256.6370614359173,
 max_diameter_cm:400,
 measurement_height_m:1.3,
 stored_field:"measurements.dbh_cm",
 stored_semantic:"circumference_cm_at_1_30_m",
 unit:"cm"
});
const DG_MEASUREMENT_PROTOCOL_LOCK=Object.freeze({
 id:"DG-MEASURE-LOCK-2026-10-06-FINAL",
 fingerprint:"e2934804cf85de5faafbb4c653a7cd955b59121f9cae0cf40f6f1229866b8066",
 payload:DG_MEASUREMENT_PROTOCOL_PAYLOAD
});
function diameterCmFromCircumference(circumferenceCm){
 const c=Number(circumferenceCm);
 return Number.isFinite(c)&&c>0?c/Math.PI:null;
}
function circumferenceCmFromDiameter(diameterCm){
 const d=Number(diameterCm);
 return Number.isFinite(d)&&d>0?d*Math.PI:null;
}
function circumferenceIsValid(circumferenceCm){
 const d=diameterCmFromCircumference(circumferenceCm);
 return d!=null&&d>0&&d<=DG_MEASUREMENT_PROTOCOL_PAYLOAD.max_diameter_cm;
}
globalThis.DG_MEASUREMENT_PROTOCOL_LOCK=DG_MEASUREMENT_PROTOCOL_LOCK;
