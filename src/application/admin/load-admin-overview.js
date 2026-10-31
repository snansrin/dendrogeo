"use strict";
(function(root){
 async function execute(profile,ports){
  if(!profile||(profile.role!=="admin"&&profile.role!=="owner"))return;
  const result=await ports.load();
  const data={users:result.users.data||[],measurements:result.measurements.data||[],projects:result.projects.data||[],global:result.global.data||{},measurementCount:result.measurementCount.count};
  ports.updateMetrics(ports.summarize(data));
  const projectById=new Map(data.projects.map(project=>[Number(project.id),project]));
  ports.renderMeasurements(result.measurements,data.measurements.map(row=>({...row,projects:projectById.get(Number(row.project_id))||null})));
  ports.refreshBasePanels();
  ports.refreshTree();
  ports.refreshParkAdmin();
  ports.refreshPublicationQueue();
 }
 root.DG_LOAD_ADMIN_OVERVIEW=Object.freeze({execute});
})(window);
