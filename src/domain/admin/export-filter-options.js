"use strict";
(function(root){
 function listCountries(rows,projects){
  const values=new Set();
  (rows||[]).forEach(row=>{const value=(row.country||"").trim();if(value)values.add(value);});
  (projects||[]).forEach(project=>{const value=(project.country||"").trim();if(value)values.add(value);});
  return [...values].sort((a,b)=>a.localeCompare(b,"tr"));
 }
 function listCities(rows,projects,country){
  const values=new Set();
  (rows||[]).forEach(row=>{const c=(row.country||"").trim(),value=(row.city||"").trim();if(value&&(!country||c===country))values.add(value);});
  (projects||[]).forEach(project=>{const c=(project.country||"").trim(),value=(project.city||"").trim();if(value&&(!country||c===country))values.add(value);});
  return [...values].sort((a,b)=>a.localeCompare(b,"tr"));
 }
 function listProjects(projects,country,city,withId){
  const list=(projects||[])
   .filter(project=>(!country||(project.country||"").trim()===country)&&(!city||(project.city||"").trim()===city))
   .sort((a,b)=>(a.name||"").localeCompare(b.name||"","tr"));
  return withId?list.map(project=>({v:String(project.id),label:project.name+(project.city?" · "+project.city:"")})):list.map(project=>project.name);
 }
 root.DG_ADMIN_EXPORT_FILTER_OPTIONS=Object.freeze({listCountries,listCities,listProjects});
})(window);
