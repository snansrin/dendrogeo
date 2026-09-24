"use strict";
/* DendroGeo · ui/lc-report.js — LULC harita katmanı + HTML rapor (Faz 5)
 * landcover.js'ten birebir taşındı: hücre/patch vektör çizimi
 * (dgLcRenderObjects), katman temizleme ve tek blok rapor üretimi
 * (dgLcRenderReport). Facade, window.DG_LANDCOVER_RENDER_REPORT'u
 * YÜKLEME ANINDA bu dosyadan referanslar → index.html'de facade'tan
 * ÖNCE yüklenmelidir. */

/* Nesneleri YUMUŞAK VEKTÖR POLİGONLAR olarak çizer.
 * Eskiden run bantları (dikdörtgen şeritler) çiziliyordu ve kullanıcı
 * "kare kare" görüyordu. Artık her nesne: sınır izi → halkalar (delikli)
 * → Chaikin yumuşatma → tek L.polygon. */
function dgLcRenderObjects(patches){
  if(DG_LC_LAYER&&typeof map!=="undefined"&&map){
    map.removeLayer(DG_LC_LAYER);
    DG_LC_LAYER=null;
  }
  if(typeof map==="undefined"||!map||!window.L)return;
  if(!patches||!patches.length)return;
  const renderer=(typeof L.canvas==="function")?L.canvas({padding:.2}):null;
  DG_LC_LAYER=L.layerGroup().addTo(map);
  for(const pt of patches){
    const cls=DG_LC_CLASSES.find(c=>c.key===(pt.classKey||pt.group));
    if(!cls||!pt.rings||!pt.rings.length)continue;
    const latlngs=pt.rings.map(ring=>ring.map(p=>[p[0],p[1]]));
    L.polygon(latlngs,{
      color:cls.color,
      weight:1.1,
      opacity:.60,
      fillColor:cls.color,
      fillOpacity:.38,
      interactive:false,
      renderer:renderer||undefined
    }).addTo(DG_LC_LAYER);
  }
}

function dgLcClearLayer(){
  if(DG_LC_LAYER&&typeof map!=="undefined"&&map){
    map.removeLayer(DG_LC_LAYER);
  }
  DG_LC_LAYER=null;
}

/* TEK BLOK rapor: kullanıcı isteği (2026-09-20) — "1 tane barlı ver ve
 * gerekli bilgileri içersin". Sınıf başına TEK satır: bar + ha + % ve alt
 * satırda gerekli ayrıntılar (hücre sayısı, çapraz uzlaşma, nesne özeti).
 * Ayrı sınıf tablosu / çapraz tablo / nesne tablosu YOK — hepsi bu blokta. */
function dgLcRenderReport(rep,result,parkAreaM2,extra){
  if(!rep)return;
  const R=result.groupAreas?result:{
    groupCounts:result.groupCounts||{},
    groupAreas:result.groupAreasM2||{},
    rawCounts:result.rawCounts||{},
    rawAreas:result.rawAreasM2||{},
    classifiedAreaM2:result.classifiedAreaM2||0,
    maskedAreaM2:result.maskedAreaM2||0,
    maskedCount:result.maskedCount||0,
    sourceCells:result.sourceCells||0,
    assignedAreaM2:result.rasterCoverageAreaM2||result.assignedAreaM2||0,
    cells:result.cells,
    runs:result.runs
  };
  const last=(typeof DG_LC_LAST!=="undefined"&&DG_LC_LAST&&DG_LC_LAST.report)?DG_LC_LAST.report:null;
  const exSrc=extra||(result.agreement||result.patches?result:last)||{};
  const ex={
    primaryYear:exSrc.primaryYear!=null?exSrc.primaryYear:exSrc.year,
    primaryLabel:exSrc.primaryLabel,
    primaryCitation:exSrc.primaryCitation,
    crossCitation:exSrc.crossCitation,
    agreement:exSrc.agreement,
    crossError:exSrc.crossError,
    patches:exSrc.patches
  };
  const analysisArea=R.assignedAreaM2;
  const GROUP_ORDER=["green","water","hard","bare","other"];

  const patchesBy={};
  for(const pt of (ex.patches||[])){
    const k=pt.classKey||pt.group;
    (patchesBy[k]=patchesBy[k]||[]).push(pt);
  }

  const aktif=GROUP_ORDER.filter(k=>(R.groupAreas?.[k]||0)>0);
  const max=aktif.length?Math.max(...aktif.map(k=>R.groupAreas[k])):1;

  const rowsHtml=aktif.map(k=>{
    const cls=DG_LC_CLASSES.find(c=>c.key===k);
    const area=R.groupAreas[k]||0;
    const count=R.groupCounts?.[k]||0;
    const pct=analysisArea>0?area/analysisArea*100:0;
    const w=max>0?Math.max(2,area/max*100):0;
    const ag=ex.agreement?.[k];
    const pl=patchesBy[k];
    const sub=[
      count.toLocaleString("tr-TR")+" hücre",
      ag?("🔬 uzlaşma %"+ag.agreementPct.toFixed(0)):null,
      pl&&pl.length?("🧩 "+pl.length+" nesne · en büyük "+
        Math.max(...pl.map(p=>p.areaHa!=null?p.areaHa:(p.areaM2||0)/10000)).toFixed(2)+" ha"):null
    ].filter(Boolean).join(" · ");
    return"<div style='margin:8px 0'>"+
      "<div style='display:flex;align-items:center;gap:8px'>"+
        "<div style='flex:0 0 106px;font-size:.75rem;font-weight:700'>"+cls.emoji+" "+cls.label+"</div>"+
        "<div style='flex:1;height:16px;background:rgba(20,30,25,.06);border-radius:8px;overflow:hidden'>"+
          "<div style='height:100%;width:"+w.toFixed(1)+"%;background:"+cls.color+"66;border:1px solid "+cls.color+";border-radius:8px'></div>"+
        "</div>"+
        "<div class='mono' style='flex:0 0 108px;text-align:right;font-size:.75rem;font-weight:600'>"+
          (area/10000).toFixed(2)+" ha <span style='color:var(--mut);font-weight:400'>%"+pct.toFixed(1)+"</span></div>"+
      "</div>"+
      "<div style='margin:2px 0 0 114px;font-size:.66rem;color:var(--mut)'>"+sub+"</div>"+
    "</div>";
  }).join("");

  const maskedPct=analysisArea>0?R.maskedAreaM2/analysisArea*100:0;
  const areaDeltaPct=parkAreaM2>0?Math.abs(analysisArea-parkAreaM2)/parkAreaM2*100:0;
  const qaOk=areaDeltaPct<=0.5;
  const maskNote=R.maskedAreaM2>0
    ?"<div style='margin-top:8px;padding:7px 10px;border-radius:8px;background:rgba(245,158,11,.10);color:#92400e;font-size:.67rem'>⚠ Veri dışı/maskeli alan: <b>"+(R.maskedAreaM2/10000).toFixed(2)+" ha</b> (%"+maskedPct.toFixed(1)+").</div>"
    :"";

  rep.innerHTML=
    "<b>🗺️ Arazi Örtüsü · 10 m · "+(ex.primaryYear||2021)+"</b>"+
    "<div style='font-size:.67rem;color:var(--mut);margin:5px 0 2px'>"+
      (ex.primaryLabel||"")+
      " · <span style='color:"+(qaOk?"var(--green-dk)":"#991b1b")+"'>"+
      (qaOk?"✓ geometrik QA geçti (%"+areaDeltaPct.toFixed(2)+" fark)":"⚠ QA farkı %"+areaDeltaPct.toFixed(2))+
      "</span></div>"+
    "<div style='margin:6px 0 4px;padding:10px 12px;border:1px solid var(--line);border-radius:12px;background:var(--bg)'>"+
      rowsHtml+
    "</div>"+
    maskNote+
    "<div style='font-size:.66rem;color:var(--mut);margin-top:8px'>"+
      "<b>Park:</b> "+(parkAreaM2/10000).toFixed(2)+" ha · "+
      "<b>Analiz:</b> "+(analysisArea/10000).toFixed(2)+" ha · "+
      "<b>Hücre:</b> "+R.sourceCells.toLocaleString("tr-TR")+" · "+
      "<b>Kapsam:</b> %"+(analysisArea>0?R.classifiedAreaM2/analysisArea*100:0).toFixed(1)+
    "</div>"+
    "<div style='font-size:.64rem;color:var(--mut);margin-top:4px'>"+
      "Kaynaklar: "+(ex.primaryCitation||"")+(ex.crossCitation?" + "+ex.crossCitation:"")+
      (ex.crossError?" · çapraz kaynak atlandı":"")+
    "</div>"+
    "<div style='display:flex;gap:7px;flex-wrap:wrap;margin-top:10px'>"+
      "<button class='btn sm ghost' onclick='downloadLandCoverClassCSV()'>📥 Sınıf CSV</button>"+
      "<button class='btn sm ghost' onclick='downloadLandCoverCellsGeoJSON()'>📍 Hücre GeoJSON</button>"+
    "</div>";
}
