"use strict";
(function(root){
 async function execute(userId,ports){
  ports.renderProfile();
  const{data}=await ports.load(userId),rows=data||[];
  ports.update({records:rows.length,carbon:rows.reduce((total,row)=>total+(row.carbon_kg||0),0).toFixed(0)});
  ports.renderChart(rows.slice(0,10).map(row=>"P"+row.point_id),rows.slice(0,10).map(row=>row.carbon_kg));
  ports.renderAnalysis(rows,"myAnalysis");
 }
 root.DG_LOAD_OWNER_DASHBOARD=Object.freeze({execute});
})(window);
