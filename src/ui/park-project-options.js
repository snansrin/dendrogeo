"use strict";
/* Render project labels and project-select options for park workflows. */
(function(root){
function label(project){
  if(!project)return "";
  return project.park_id?project.name:"⛔ "+project.name+" (park yok)";
}

function forPark({parkId,fallbackAll,projects,escape:esc}){
  const list=projects||[];
  const mine=parkId?list.filter(project=>project.park_id===parkId):[];
  if(mine.length){
    return mine.map(project=>`<option value="${project.id}">${esc(project.name)}</option>`).join("");
  }
  if(fallbackAll&&list.length){
    return list.map(project=>`<option value="${project.id}">${esc(project.name)}</option>`).join("");
  }
  return `<option value="0">Bu park için proje yok — algılama kartından oluştur</option>`;
}

function readSelected(document){return document.getElementById("mProject")?.value||"";}
function clearPointSuggestion(document){
  const point=document.getElementById("mPoint"),result=document.getElementById("pointQueryResult");
  if(point)point.value="";
  if(result)result.style.display="none";
}

root.DG_PARK_PROJECT_OPTIONS_UI=Object.freeze({label,forPark,readSelected,clearPointSuggestion});
})(window);
