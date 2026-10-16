"use strict";
(function(root){
 async function render(id,type,labels,data,ports){
  if(ports.ensure)await ports.ensure();
  const ChartCtor=ports.getChart?ports.getChart():ports.Chart;
  if(typeof ChartCtor!=="function")throw new Error("Grafik kütüphanesi yüklenemedi.");
  if(ports.charts[id])ports.charts[id].destroy();
  const palette=["#14532d","#1e6f4b","#2e8b57","#3aa76d","#6aa84f","#8fbc6d","#c77d2e","#d97706","#92400e","#4c9a52"];
  ports.charts[id]=new ChartCtor(ports.element(id),{type,data:{labels,datasets:[{data,backgroundColor:context=>palette[context.dataIndex%palette.length],borderRadius:8,borderSkipped:false,barPercentage:.6}]},options:{plugins:{legend:{display:false}},scales:type==="bar"?{y:{grid:{color:"rgba(20,30,25,.06)"},ticks:{color:"#5f6d65"}},x:{grid:{display:false},ticks:{color:"#5f6d65"}}}:undefined}});
  root.DG_APPEARANCE?.refreshCharts();
 }
 root.DG_DASHBOARD_CHART=Object.freeze({render});
})(window);
