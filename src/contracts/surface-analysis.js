"use strict";
/* Runtime contracts for the surface analysis pipeline.
 * Structural checks only: no DOM, raster, map, or persistence dependencies. */
(function(root){
  const VERSION=1;
  const record=value=>value!==null&&typeof value==="object"&&!Array.isArray(value);
  const fail=(name,detail)=>{throw new TypeError(name+" DTO geçersiz: "+detail);};
  const number=(value,name,{positive=false}={})=>{
    if(typeof value!=="number"||!Number.isFinite(value)||(positive?value<=0:value<0))
      fail(name,positive?"pozitif sonlu sayı bekleniyor":"negatif olmayan sonlu sayı bekleniyor");
  };
  function numericMap(value,name){
    if(!record(value))fail(name,"sayısal değer haritası bekleniyor");
    for(const [key,entry] of Object.entries(value)){
      if(!key)fail(name,"boş anahtar kullanılamaz");
      number(entry,name+"."+key);
    }
  }
  function assertCell(cell){
    const name="SurfaceCell";
    if(!record(cell))fail(name,"nesne bekleniyor");
    for(const key of ["row","col","epsg","classCode"])
      if(!Number.isInteger(cell[key]))fail(name,key+" tamsayı olmalı");
    if(typeof cell.classKey!=="string"||!cell.classKey)fail(name,"classKey boş olmayan metin olmalı");
    if(typeof cell.source!=="string"||!cell.source)fail(name,"source boş olmayan metin olmalı");
    number(cell.areaM2,name+".areaM2",{positive:true});
    if(!record(cell.center))fail(name,"center nesnesi bekleniyor");
    for(const axis of ["lat","lon"])
      if(typeof cell.center[axis]!=="number"||!Number.isFinite(cell.center[axis]))fail(name,"center."+axis+" sonlu sayı olmalı");
    if(!Array.isArray(cell.quadWgs)||cell.quadWgs.length!==4||cell.quadWgs.some(point=>
      !Array.isArray(point)||point.length!==2||point.some(value=>typeof value!=="number"||!Number.isFinite(value))))
      fail(name,"quadWgs dört sonlu [lon, lat] köşesi içermeli");
    return cell;
  }
  function assertAnalysisResult(result){
    const name="AnalysisResult";
    if(!record(result))fail(name,"nesne bekleniyor");
    for(const key of ["assignedAreaM2","classifiedAreaM2","maskedAreaM2"])number(result[key],name+"."+key);
    if(result.classifiedAreaM2>result.assignedAreaM2+1e-6||result.maskedAreaM2>result.assignedAreaM2+1e-6)
      fail(name,"sınıflanan veya maskelenen alan atanan alanı aşamaz");
    if(!Number.isInteger(result.sourceCells)||result.sourceCells<0)fail(name,"sourceCells negatif olmayan tamsayı olmalı");
    for(const key of ["groupCounts","groupAreas","rawCounts","rawAreas"])numericMap(result[key],name+"."+key);
    if(!Array.isArray(result.cells))fail(name,"cells dizisi bekleniyor");
    result.cells.forEach(assertCell);
    if(result.cells.length>result.sourceCells)fail(name,"cells sayısı sourceCells değerini aşamaz");
    return result;
  }
  function assertPatch(patch){
    if(!record(patch))fail("SurfacePatch","nesne bekleniyor");
    if(typeof patch.classKey!=="string"||!patch.classKey)fail("SurfacePatch","classKey boş olmayan metin olmalı");
    number(patch.areaM2,"SurfacePatch.areaM2",{positive:true});
    if(!record(patch.centroid)||["lat","lon"].some(key=>typeof patch.centroid[key]!=="number"||!Number.isFinite(patch.centroid[key])))
      fail("SurfacePatch","centroid sonlu lat/lon içermeli");
    if(!Number.isInteger(patch.cells)||patch.cells<1)fail("SurfacePatch","cells pozitif tamsayı olmalı");
    return patch;
  }
  function assertSourceEvidence(evidence){
    if(!record(evidence))fail("SourceEvidence","nesne bekleniyor");
    assertAnalysisResult(evidence.result);
    if(!Array.isArray(evidence.items)||evidence.items.some(id=>typeof id!=="string"||!id))
      fail("SourceEvidence","items boş olmayan kimlik dizisi olmalı");
    return evidence;
  }
  function createAnalysisError(error,code="ANALYSIS_FAILED",retryable=false){
    if(typeof code!=="string"||!code)throw new TypeError("AnalysisError.code boş olmayan metin olmalı");
    return Object.freeze({version:VERSION,code,message:String(error?.message||error||"Analiz başarısız."),retryable:retryable===true});
  }
  function assertAnalysisOutput(output){
    if(!record(output))fail("SurfaceAnalysisOutput","nesne bekleniyor");
    assertAnalysisResult(output.result);
    if(!record(output.report)||!record(output.report.classes))fail("SurfaceAnalysisOutput","report ve report.classes nesneleri bekleniyor");
    if(!Array.isArray(output.patches))fail("SurfaceAnalysisOutput","patches dizisi bekleniyor");
    output.patches.forEach(assertPatch);
    if(output.crossResult!==null)assertAnalysisResult(output.crossResult);
    return output;
  }
  root.DG_SURFACE_CONTRACTS=Object.freeze({version:VERSION,assertCell,assertAnalysisResult,assertPatch,
    assertSourceEvidence,assertAnalysisOutput,createAnalysisError});
})(window);
