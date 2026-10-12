"use strict";
(function(root){
 function render(species,latin){
  return `<table><thead><tr><th scope='col'>Tür</th><th scope='col'>Latince</th><th scope='col'>Grup</th><th scope='col'>Adet</th><th scope='col'>Karbon (kg)</th><th scope='col'>Ort. Çap</th><th scope='col'>Ort. Boy</th></tr></thead><tbody>`+
   species.map(([name,value])=>`<tr><td>${name}</td><td style="font-style:italic">${latin[name]&&latin[name]!=="—"?latin[name]:"—"}</td><td>${value.group}</td><td>${value.count}</td><td>${value.carbon.toFixed(1)}</td><td>${(value.dbh/value.count).toFixed(1)}</td><td>${(value.height/value.count).toFixed(1)}</td></tr>`).join("")+
   `</tbody></table>`;
 }
 root.DG_PARK_REPORT_SPECIES_TABLE=Object.freeze({render});
})(window);
