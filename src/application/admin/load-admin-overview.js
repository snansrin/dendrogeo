"use strict";
(function(root){
 async function execute(profile,ports){
  if(!profile||(profile.role!=="admin"&&profile.role!=="owner"))return;
  const result=await ports.load();
  const data={users:result.users.data||[],measurements:result.measurements.data||[],projects:result.projects.data||[],global:result.global.data||{},measurementCount:result.measurementCount.count};
  ports.updateMetrics(ports.summarize(data));
  ports.renderMeasurements(result.measurements,data.measurements);
  ports.refreshBasePanels();
  ports.refreshTree();
  ports.refreshParkAdmin();
  ports.refreshPublicationQueue();
 }
 root.DG_LOAD_ADMIN_OVERVIEW=Object.freeze({execute});
})(window);
