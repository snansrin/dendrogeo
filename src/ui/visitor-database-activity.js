"use strict";

/* Render the owner's stored activity table from already-loaded rows. */
(function(root){
 function render(box,rows,{locale="tr-TR",translate=value=>value,escape=value=>String(value)}={}){
  if(!box)return;
  if(!rows.length){box.innerHTML='<div class="alert info">'+translate("Etkinlik yok")+'</div>';return;}
  const labels=["Zaman","Kim","Ne yaptı","Ayrıntı"];
  box.innerHTML='<table><thead><tr>'+labels.map(label=>'<th scope="col">'+translate(label)+'</th>').join("")+'</tr></thead><tbody>'+rows.slice(0,60).map(row=>{
   let time="—";try{time=row.t?new Date(row.t).toLocaleString(locale):"—";}catch(error){}
   const values=[time,row.who||"—",row.what||"—",row.det||"—"];
   return '<tr>'+values.map((value,index)=>'<td data-label="'+translate(labels[index])+'"'+(index===0?' class="mono" style="white-space:nowrap"':'')+'>'+escape(String(value))+'</td>').join("")+'</tr>';
  }).join("")+'</tbody></table>';
 }
 root.DG_VISITOR_DATABASE_ACTIVITY_UI=Object.freeze({render});
})(window);
