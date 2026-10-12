"use strict";
(function(root){
 function render(summary,{groupColor,groupColorInk,escape,latin}){
  const{groups,total,averageDbh,averageHeight,percent,topSpecies}=summary;
  const ib=groups["İBRELİ"],ya=groups["YAPRAKLI"];
  return `<div class="card">
   <div class="shead" style="margin-bottom:14px"><span class="no">🌳</span><h2 style="font-size:1.15rem">Ağaç Çeşitliliği & Yapısal Analiz</h2><span class="rule"></span><span class="mono" style="font-size:.78rem;color:var(--mut)">${total} onaylı kayıt</span></div>
   <div style="margin-bottom:18px">
    <div class="lbl" style="margin-bottom:8px">Grup Dağılımı</div>
    <div style="display:flex;justify-content:space-between;font-size:.78rem;margin-bottom:6px;color:var(--mut)">
     <span><span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${groupColor["İBRELİ"]};margin-right:5px"></span>İbreli <b style="color:var(--ink)">${percent.conifer}%</b></span>
     <span><span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${groupColor["YAPRAKLI"]};margin-right:5px"></span>Yapraklı <b style="color:var(--ink)">${percent.broadleaf}%</b></span>
     <span><span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${groupColor["DİĞER"]};margin-right:5px"></span>Diğer <b style="color:var(--ink)">${percent.other}%</b></span>
    </div>
    <div style="display:flex;height:14px;border-radius:7px;overflow:hidden;background:var(--line)">
     <div style="width:${percent.conifer}%;background:${groupColor["İBRELİ"]};transition:width .6s"></div>
     <div style="width:${percent.broadleaf}%;background:${groupColor["YAPRAKLI"]};transition:width .6s"></div>
     <div style="width:${percent.other}%;background:${groupColor["DİĞER"]};transition:width .6s"></div>
    </div>
   </div>
   <div class="grid g4" style="margin-bottom:18px">
    <div class="stat" style="padding:14px"><div class="lbl">Ort. Çap</div><div class="val" style="font-size:1.15rem">${averageDbh} <span style="font-size:.7rem;font-weight:400">cm</span></div></div>
    <div class="stat" style="padding:14px"><div class="lbl">Ort. Boy</div><div class="val" style="font-size:1.15rem">${averageHeight} <span style="font-size:.7rem;font-weight:400">m</span></div></div>
    <div class="stat" style="padding:14px"><div class="lbl" style="color:${groupColorInk["İBRELİ"]}">İbreli Ort.Boy</div><div class="val" style="font-size:1.15rem">${ib.n?(ib.h/ib.n).toFixed(1):"—"} <span style="font-size:.7rem;font-weight:400">m</span></div></div>
    <div class="stat" style="padding:14px"><div class="lbl" style="color:${groupColorInk["YAPRAKLI"]}">Yapraklı Ort.Boy</div><div class="val" style="font-size:1.15rem">${ya.n?(ya.h/ya.n).toFixed(1):"—"} <span style="font-size:.7rem;font-weight:400">m</span></div></div>
   </div>
   <div class="lbl" style="margin-bottom:10px">En Yaygın 6 Tür</div>
   ${topSpecies.map(([species,value])=>`<div style="margin-bottom:12px">
     <div style="display:flex;justify-content:space-between;font-size:.78rem;margin-bottom:6px;color:var(--mut)">
      <span><span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${groupColor[value.grp]};margin-right:5px"></span>${escape(species)} <i style="font-style:italic;font-size:.7rem;color:var(--mut)">${escape(latin[species])||""}</i></span>
      <span><b style="color:var(--ink)">${value.n}</b> (${(value.n/total*100).toFixed(1)}%)</span>
     </div>
     <div style="display:flex;height:14px;border-radius:7px;overflow:hidden;background:var(--line)">
      <div style="width:${(value.n/total*100).toFixed(1)}%;background:${groupColor[value.grp]};transition:width .6s"></div>
     </div>
    </div>`).join("")}
  </div>`;
 }
 root.DG_TREE_ANALYSIS_UI=Object.freeze({render});
})(window);
