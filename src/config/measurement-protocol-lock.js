"use strict";
/*
 * DendroGeo saha ölçüm protokolü — DEĞİŞTİRİLEMEZ KİLİT.
 *
 * Saha mezurasıyla 1,30 m yükseklikte ölçülen ham değer GÖVDE ÇEVRESİDİR.
 * Ham değer measurements.girth_cm alanında saklanır. Gerçek DBH çapı yalnız:
 *
 *   DBH [cm] = göğüs çevresi [cm] / π
 *
 * ile türetilir ve measurements.dbh_cm alanına yazılır. Allometri, hacim,
 * QA, rapor ve dışa aktarım yalnız türetilmiş DBH çapını kullanır.
 */
const DG_MEASUREMENT_PROTOCOL_PAYLOAD=Object.freeze({
 allometry_input:"derived_diameter_cm",
 derived_field:"measurements.dbh_cm",
 derived_semantic:"diameter_cm",
 diameter_conversion:"diameter_cm=circumference_cm/pi",
 max_circumference_cm:1256.6370614359173,
 max_diameter_cm:400,
 measurement_height_m:1.3,
 raw_field:"measurements.girth_cm",
 raw_semantic:"circumference_cm_at_1_30_m",
 unit:"cm"
});
const DG_MEASUREMENT_PROTOCOL_LOCK=Object.freeze({
 id:"DG-MEASURE-LOCK-2026-10-06-FINAL",
 fingerprint:"4e48cf360622b5633e664618a8626756b3207cec8dd63a3158714e957eae3212",
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
