"use strict";
/* Pure park identity, sorting and photo URL validation. No data reads or writes. */
(function(root){
const sortPoints=(a,b)=>(Number(a.point_id)||0)-(Number(b.point_id)||0)||(Number(a.measurement_no)||1)-(Number(b.measurement_no)||1)||(Number(a.project_id)||0)-(Number(b.project_id)||0)||String(a.created_at||"").localeCompare(String(b.created_at||""))||(Number(a.id)||0)-(Number(b.id)||0);
 const slug=name=>String(name||"park").normalize("NFKD").replace(/[^\w-]+/g,"_").replace(/^_+|_+$/g,"").slice(0,80)||"park";
 function photoURL(value,origin){
  try{
   const url=new URL(String(value)),base=new URL(origin);
   return url.protocol==="https:"&&url.origin===base.origin&&url.pathname.startsWith("/storage/v1/object/public/dendro-photos/")?url.href:"";
  }catch{return "";}
 }
 function parkOf(project){
  const id=Number(project.park_id)||0;
  return {key:id?"park:"+id:"project:"+project.id,id,name:project.parks?.name||project.park_name||project.name||"Proje",area:Number(project.parks?.area_m2)||null};
 }
 function groupProjects(projects){
  const groups=new Map();
  for(const project of projects||[]){
   const park=parkOf(project),group=groups.get(park.key)||{...park,projects:[]};
   group.projects.push({id:Number(project.id),name:project.name||"Proje"});
   if(!group.area&&park.area)group.area=park.area;
   groups.set(park.key,group);
  }
  return groups;
 }
  root.DG_SHARED_PARK_INVENTORY_DOMAIN=Object.freeze({sortPoints,slug,photoURL,parkOf,groupProjects});
})(window);
