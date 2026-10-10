"use strict";
/* Present an accepted grid using the existing state and rendering ports. */
(function(root){
 function complete({outcome:{result,signature,review},clearance,clear,setSource,setMeta,cells,render,translate,translateFormat,notify}){
  clear();setSource(signature);
  setMeta(`<p class="measure-help">${translate("Su ve sert zeminden uzaklık")}: ${clearance} m · ${translate(review?.editing?"Yüzey önizlemesi":"Kayıtlı yüzey")} · ${(result.areaM2/10000).toFixed(3)} ha ${translate("uygun alan")}</p>`);
  cells.push(...result.cells);render();
  notify(translateFormat("✓ Grid hazır: {n} hücre",{n:cells.length}),cells.length?"ok":"warn","🔲");
 }
 root.DG_GRID_BUILD_COMPLETION_UI=Object.freeze({complete});
})(window);
