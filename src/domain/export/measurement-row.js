"use strict";
(function(root){
 function build(row,{calculate,latin,DateType=Date,MathType=Math}={}){
  const c=calculate(row.dbh_cm,row.height_m,row.species,row.grp);
  const slope=+(row.slope_deg||0),agb=row.agb_kg||c.agb,bhb=row.bhb_kg||c.bhb,bio=agb+bhb;
  const area=MathType.PI*MathType.pow((row.dbh_cm||0)/200,2),horizontalArea=area*MathType.cos(slope*MathType.PI/180),volume=area*(row.height_m||0)*0.5;
  const date=new DateType(row.created_at),quote=value=>`"${(value||"").toString().replace(/"/g,'""')}"`;
  const photo=row.photo_file||(row.photo_url?("P"+String(row.point_id).padStart(3,"0")+"_M"+(row.measurement_no||1)+".JPG"):"");
  const circumference=Number.isFinite(+row.girth_cm)&&+row.girth_cm>0?+row.girth_cm:MathType.PI*(row.dbh_cm||0);
  const dbh=Number.isFinite(+row.dbh_cm)?(+row.dbh_cm).toFixed(1):"";
  return [row.point_id,row.measurement_no||1,date.toLocaleDateString("tr-TR"),date.toLocaleTimeString("tr-TR"),row.lat,row.lon,(row.altitude_m??""),(row.altitude_m??""),(row.satellites??""),(row.hdop??""),(row.accuracy_m??""),slope,quote(row.grp),quote(row.species),quote(latin[row.species]||""),circumference,dbh,row.height_m,area.toFixed(4),horizontalArea.toFixed(4),volume.toFixed(4),agb.toFixed(1),bhb.toFixed(1),bio.toFixed(1),(row.carbon_kg||bio*0.47).toFixed(2),(agb*0.47).toFixed(1),(bhb*0.47).toFixed(1),photo,quote(row.photo_url||""),date.toISOString().slice(0,10)].join(",");
 }
 root.DG_EXPORT_MEASUREMENT_ROW=Object.freeze({build});
})(window);
