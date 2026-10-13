"use strict";

/* User-facing summary for the calibrated multi-class photo gate. */
window.DG_MEASUREMENT_PHOTO_SUMMARY={
  format(metrics,translate=value=>value){
    const percent=value=>"%"+Math.round(value*100);const parts=[];
    if(metrics.green>=0.05)parts.push(translate("yeşil örtü")+" "+percent(metrics.green));
    if(metrics.purple>=0.05)parts.push(translate("kızıl/mor yaprak")+" "+percent(metrics.purple));
    if(metrics.warm>=0.05)parts.push(translate("sonbahar rengi")+" "+percent(metrics.warm));
    if(metrics.woody>=0.05)parts.push(translate("gövde/dal")+" "+percent(metrics.woody));
    if(metrics.blue>=0.25&&(metrics.struct>=0.025||metrics.dark>=0.03))parts.push(translate("kış kadrajı (dal silüeti)"));
    return parts.join(" · ");
  }
};
