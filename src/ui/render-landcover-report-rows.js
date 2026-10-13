"use strict";

/* Render the existing single-line-per-class report rows. */
window.DG_LANDCOVER_REPORT_ROWS={
  render(rows){
    return rows.map(row=>{
      const details=[row.count.toLocaleString("tr-TR")+" hücre",row.agreement?("🔬 uzlaşma %"+row.agreement.agreementPct.toFixed(0)):null,row.patchCount?("🧩 "+row.patchCount+" nesne · en büyük "+row.largestPatchHa.toFixed(2)+" ha"):null].filter(Boolean).join(" · ");
      return"<div style='margin:8px 0'>"+
        "<div style='display:flex;align-items:center;gap:8px'>"+
          "<div style='flex:0 0 106px;font-size:.75rem;font-weight:700'>"+row.emoji+" "+row.label+"</div>"+
          "<div style='flex:1;height:16px;background:rgba(20,30,25,.06);border-radius:8px;overflow:hidden'>"+
            "<div style='height:100%;width:"+row.width.toFixed(1)+"%;background:"+row.color+"66;border:1px solid "+row.color+";border-radius:8px'></div>"+
          "</div>"+
          "<div class='mono' style='flex:0 0 108px;text-align:right;font-size:.75rem;font-weight:600'>"+(row.area/10000).toFixed(2)+" ha <span style='color:var(--mut);font-weight:400'>%"+row.pct.toFixed(1)+"</span></div>"+
        "</div>"+
        "<div style='margin:2px 0 0 114px;font-size:.66rem;color:var(--mut)'>"+details+"</div>"+
      "</div>";
    }).join("");
  }
};
