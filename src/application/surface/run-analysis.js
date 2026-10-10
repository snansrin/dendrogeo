"use strict";
/* One surface-analysis use-case. Infrastructure and mutable UI state enter
 * only through injected functions; this module owns validation, orchestration,
 * and the result DTO, but performs no DOM, network, map, or persistence work. */
(function(root){
  function createRunSurfaceAnalysis({
    ensureRaster,hasRaster,getSources,getPixelSize,getBbox,analyzeSource,
    detectPatches,getClasses,assertCoverage
  }){
    const required={ensureRaster,hasRaster,getSources,getPixelSize,getBbox,analyzeSource,detectPatches,getClasses,assertCoverage};
    if(Object.values(required).some(fn=>typeof fn!=="function"))
      throw new TypeError("Yüzey analizi use-case'i için tüm bağımlılık portları gereklidir.");
    return Object.freeze({run:async function(params){
      const outer=params?.outer||[],holes=params?.holes||[],parkAreaM2=Number(params?.parkAreaM2||0);
      if(!outer.length)throw new Error("Analiz için park polygonu yok.");
      if(!(parkAreaM2>0))throw new Error("Park alanı geçersiz.");
      await ensureRaster();
      if(!hasRaster())throw new Error("10 m COG okuyucu yüklenmedi.");
      const sources=getSources(),bbox=getBbox(outer,holes),geom={outer,holes};
      // The primary published classification is authoritative; other sources
      // may supply evidence but cannot silently relabel this baseline.
      const primary=await analyzeSource(sources.primary,bbox,geom);
      const result=primary?.result;
      if(!result||typeof result!=="object")throw new Error("Birincil raster kaynağı geçerli analiz sonucu döndürmedi.");
      const deltaPct=assertCoverage(result.assignedAreaM2,parkAreaM2,0.5);
      if(!root.DG_SURFACE_CONTRACTS)throw new Error("Yüzey analiz DTO sözleşmeleri yüklenmedi.");
      root.DG_SURFACE_CONTRACTS.assertSourceEvidence(primary);
      const patches=detectPatches(result.cells),cross=null,crossErr=null,waterRefined=0,roadRefined=0;
      const report={
        year:sources.primary.year,crossYear:sources.cross.year,resolutionM:getPixelSize(),
        primaryLabel:sources.primary.label,crossLabel:null,
        primaryCitation:sources.primary.citation,crossCitation:null,
        parkAreaM2,rasterCoverageAreaM2:result.assignedAreaM2,
        classifiedAreaM2:result.classifiedAreaM2,maskedAreaM2:result.maskedAreaM2,
        sourceCells:result.sourceCells,groupCounts:result.groupCounts,groupAreasM2:result.groupAreas,
        rawCounts:result.rawCounts,rawAreasM2:result.rawAreas,
        patches:patches.map(pt=>({group:pt.classKey,areaHa:+(pt.areaM2/10000).toFixed(3),cells:pt.cells,
          centroidLat:+pt.centroid.lat.toFixed(6),centroidLon:+pt.centroid.lon.toFixed(6)})),
        agreement:null,waterRefinedCells:waterRefined,roadRefinedCells:roadRefined,crossError:crossErr,
        primaryItems:primary.items,crossItems:null,areaDeltaPct:deltaPct,
        classes:Object.fromEntries(getClasses().map(cls=>{
          const area=result.groupAreas?.[cls.key]||0,count=result.groupCounts?.[cls.key]||0;
          return[cls.key,{label:cls.label,emoji:cls.emoji,color:cls.color,count,areaM2:area,
            areaHa:+(area/10000).toFixed(3),pct:result.assignedAreaM2>0?+(area/result.assignedAreaM2*100).toFixed(2):0}];
        }))
      };
      return root.DG_SURFACE_CONTRACTS.assertAnalysisOutput({report,result,crossResult:cross?cross.result:null,patches});
    }});
  }
  root.DG_SURFACE_APPLICATION=Object.freeze({createRunSurfaceAnalysis});
})(window);
