"use strict";
/* === BÖLGE A  === */
const FULL_HEAD="POINT_ID,MEASUREMENT_NO,DATE,TIME_TR,LATITUDE,LONGITUDE,GPS_ALTITUDE_M,GPS_ALTITUDE_MEDIAN_M,SATELLITES,HDOP,EST_ERROR_M,SLOPE_DEG,TREE_GROUP,TREE_SPECIES,LATIN_NAME,CIRCUMFERENCE_CM,DBH_CM,TREE_HEIGHT_M,CALC_AREA_M2,HORIZONTAL_AREA_M2,CALC_VOLUME_M3,AGB_KG,BHB_KG,TOTAL_BIOMASS_KG,CARBON_KG,AGB_CARBON_KG,BHB_CARBON_KG,PHOTO_FILE,PHOTO_URL,DATE_ISO";
function fullRow(r){
 const c=calc(r.dbh_cm,r.height_m,r.species,r.grp);
 const slope=+(r.slope_deg||0);
 const agb=r.agb_kg||c.agb,bhb=r.bhb_kg||c.bhb,bio=agb+bhb;
 const area=Math.PI*Math.pow((r.dbh_cm||0)/200,2);
 const hArea=area*Math.cos(slope*Math.PI/180);
 const vol=area*(r.height_m||0)*0.5;
 const d=new Date(r.created_at);
 const pf=r.photo_file||(r.photo_url?("P"+String(r.point_id).padStart(3,"0")+"_M"+(r.measurement_no||1)+".JPG"):"");
 const q=v=>`"${(v||"").toString().replace(/"/g,'""')}"`;
 return [r.point_id,r.measurement_no||1,d.toLocaleDateString("tr-TR"),d.toLocaleTimeString("tr-TR"),r.lat,r.lon,(r.altitude_m??""),(r.altitude_m??""),(r.satellites??""),(r.hdop??""),(r.accuracy_m??""),slope,q(r.grp),q(r.species),q(LATIN[r.species]||""),(Math.PI*(r.dbh_cm||0)).toFixed(2),r.dbh_cm,r.height_m,area.toFixed(4),hArea.toFixed(4),vol.toFixed(4),agb.toFixed(1),bhb.toFixed(1),bio.toFixed(1),(r.carbon_kg||bio*0.47).toFixed(2),(agb*0.47).toFixed(1),(bhb*0.47).toFixed(1),pf,q(r.photo_url||""),d.toISOString().slice(0,10)].join(",");
}
function fullCSV(rows){return "\uFEFF"+FULL_HEAD+"\n"+rows.map(fullRow).join("\n")+"\n";}
/* === BÖLGE B  === */
async function getMine(){
let out=[],from=0,step=1000;
for(;;){
const{data}=await sb.from("measurements").select("*,projects(name)").eq("owner",USER.id).order("created_at",{ascending:false}).range(from,from+step-1);
out=out.concat(data||[]);
if(!data||data.length<step)break;
from+=step;
}
return out;
}
async function exportCSV(){const d=await getMine();dl(fullCSV(d),"dendrogeo.csv");}
async function exportQgis(){const d=await getMine();dl(fullCSV(d),"dendrogeo_qgis.csv");}
async function exportGeo(){
 const d=await getMine();
 const gj={type:"FeatureCollection",features:d.map(r=>({type:"Feature",geometry:{type:"Point",coordinates:[r.lon,r.lat]},properties:{point:r.point_id,species:r.species,latin:LATIN[r.species]||"",dbh:r.dbh_cm,height:r.height_m,carbon:r.carbon_kg,photo:r.photo_url||""}}))};
 dl(JSON.stringify(gj,null,2),"dendrogeo.geojson");
}
function dl(content,name){const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([content],{type:"text/csv;charset=utf-8;"}));a.download=name;a.click();}

function openPreview(title,content,isCSV,fname){
 $("pvTitle").textContent=title;
 if(isCSV){
  const lines=content.replace(/^\uFEFF/,"").split("\n").filter(Boolean).slice(0,100);
  let html="<table><thead><tr>"+lines[0].split(",").map(h=>`<th>${h}</th>`).join("")+"</tr></thead><tbody>";
  for(let i=1;i<lines.length;i++)html+="<tr>"+lines[i].split(",").map(c=>`<td>${esc(c)}</td>`).join("")+"</tr>";
  $("pvBody").innerHTML=html+"</tbody></table>";
 }else{$("pvBody").innerHTML=`<pre style="font-size:.75rem;white-space:pre-wrap">${esc(content.slice(0,20000))}</pre>`;}
 $("pvDownload").onclick=()=>dl(content,fname);
 $("previewModal").classList.add("on");
}
function closePreview(){$("previewModal").classList.remove("on");}
async function previewCSV(){const d=await getMine();openPreview("CSV Önizleme (ilk 100 satır)",fullCSV(d),true,"dendrogeo.csv");}
async function previewGeo(){const d=await getMine();const gj={type:"FeatureCollection",features:d.map(r=>({type:"Feature",geometry:{type:"Point",coordinates:[r.lon,r.lat]},properties:{point:r.point_id,species:r.species,carbon:r.carbon_kg}}))};openPreview("GeoJSON Önizleme",JSON.stringify(gj,null,2),false,"dendrogeo.geojson");}

