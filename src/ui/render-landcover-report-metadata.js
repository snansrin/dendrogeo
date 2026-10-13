"use strict";

/* Render QA, mask, coverage, and source provenance blocks. */
window.DG_LANDCOVER_REPORT_METADATA={
  render(model){
    const{result,evidence,analysisArea,parkAreaM2,qa,maskedPct,coveragePct}=model;
    const heading="<b>🗺️ Arazi Örtüsü · 10 m · "+(evidence.primaryYear||2021)+"</b>"+
      "<div style='font-size:.67rem;color:var(--mut);margin:5px 0 2px'>"+(evidence.primaryLabel||"")+" · <span style='color:"+(qa.passed?"var(--green-dk)":"#991b1b")+"'>"+
      (qa.passed?"✓ geometrik QA geçti (%"+qa.areaDeltaPct.toFixed(2)+" fark)":"⚠ QA farkı %"+qa.areaDeltaPct.toFixed(2))+"</span></div>";
    const mask=result.maskedAreaM2>0?"<div style='margin-top:8px;padding:7px 10px;border-radius:8px;background:rgba(245,158,11,.10);color:#92400e;font-size:.67rem'>⚠ Veri dışı/maskeli alan: <b>"+(result.maskedAreaM2/10000).toFixed(2)+" ha</b> (%"+maskedPct.toFixed(1)+").</div>":"";
    const coverage="<div style='font-size:.66rem;color:var(--mut);margin-top:8px'><b>Park:</b> "+(parkAreaM2/10000).toFixed(2)+" ha · <b>Analiz:</b> "+(analysisArea/10000).toFixed(2)+" ha · <b>Hücre:</b> "+result.sourceCells.toLocaleString("tr-TR")+" · <b>Kapsam:</b> %"+coveragePct.toFixed(1)+"</div>";
    const sources="<div style='font-size:.64rem;color:var(--mut);margin-top:4px'>Kaynaklar: "+(evidence.primaryCitation||"")+(evidence.crossCitation?" + "+evidence.crossCitation:"")+(evidence.crossError?" · çapraz kaynak atlandı":"")+"</div>";
    return{heading,mask,coverage,sources};
  }
};
