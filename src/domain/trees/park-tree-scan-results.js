"use strict";
/* Boxes are crown extent proxies, never measured crown masks or inventory records. */
(function(root){
 function distance(a,b){const r=Math.PI/180,dlat=(b[0]-a[0])*r,dlon=(b[1]-a[1])*r,s=Math.sin(dlat/2)**2+Math.cos(a[0]*r)*Math.cos(b[0]*r)*Math.sin(dlon/2)**2;return 12742017.6*Math.asin(Math.min(1,Math.sqrt(s)));}
 function overlap(a,b){const intersection=Math.max(0,Math.min(a[2],b[2])-Math.max(a[0],b[0]))*Math.max(0,Math.min(a[3],b[3])-Math.max(a[1],b[1]));const area=x=>(x[2]-x[0])*(x[3]-x[1]);return{union:intersection/(area(a)+area(b)-intersection||1),smaller:intersection/(Math.min(area(a),area(b))||1)};}
 function collect(raw,chip){
  const normalized=root.DG_TREE_DETECTION_RESULTS.build(raw,{width:chip.width,height:chip.height,imageId:String(chip.id),modelId:raw.modelId},{confidence:0,nmsIou:.5});
  if(raw.predictions.length&&normalized.counts.unknownLabels===raw.predictions.length)throw Error('model_labels_mismatch');
  return normalized.candidates.map(candidate=>({...candidate,chipId:chip.id,edge:candidate.partial||candidate.boxPixels[0]<=2||candidate.boxPixels[1]<=2||candidate.boxPixels[2]>=chip.width-2||candidate.boxPixels[3]>=chip.height-2,globalBox:candidate.boxPixels.map((v,i)=>v+(i%2?chip.y:chip.x))}));
 }
 function summarize(rows,plan,confidence,{completed,total,startedAt}){
  if(!Number.isFinite(confidence)||confidence<0||confidence>1)throw Error('invalid_threshold');
  if(rows.length>12000)throw Error('too_many_candidates');
  const kept=[],index=new Map(),cells=box=>{const keys=[];for(let x=Math.floor(box[0]/128);x<=Math.floor(box[2]/128);x++)for(let y=Math.floor(box[1]/128);y<=Math.floor(box[3]/128);y++)keys.push(x+':'+y);return keys;},inside=p=>root.DG_PARK_CONTAINMENT.pointInPark(p[0],p[1],plan.park);
  for(const candidate of rows.filter(r=>r.confidence>=confidence).sort((a,b)=>b.confidence-a.confidence||Number(a.edge)-Number(b.edge)||a.chipId-b.chipId)){
   const [left,top,right,bottom]=candidate.globalBox,midX=(left+right)/2,midY=(top+bottom)/2;
   const center=root.DG_PARK_TREE_SCAN_PLAN.coordinate(midX,midY,plan.zoom);if(!inside(center))continue;
   const keys=cells(candidate.globalBox),neighbors=new Set(keys.flatMap(key=>index.get(key)||[]));
   if([...neighbors].some(other=>{const o=overlap(candidate.globalBox,other.globalBox);return o.union>=.4||((candidate.edge||other.edge)&&o.smaller>=.75);}))continue;
   const corners=[[left,top],[right,top],[right,bottom],[left,bottom]].map(([x,y])=>root.DG_PARK_TREE_SCAN_PLAN.coordinate(x,y,plan.zoom));
   const boundaryPartial=corners.some(p=>!inside(p));
   const horizontal=distance(root.DG_PARK_TREE_SCAN_PLAN.coordinate(left,midY,plan.zoom),root.DG_PARK_TREE_SCAN_PLAN.coordinate(right,midY,plan.zoom));
   const vertical=distance(root.DG_PARK_TREE_SCAN_PLAN.coordinate(midX,top,plan.zoom),root.DG_PARK_TREE_SCAN_PLAN.coordinate(midX,bottom,plan.zoom));
   for(const key of keys){if(!index.has(key))index.set(key,[]);index.get(key).push(candidate);}
   kept.push({...candidate,id:kept.length+1,center,corners,boundaryPartial,crownWidthM:null,crownAreaM2:null,crownEstimate:candidate.edge||boundaryPartial?null:{method:'detection-box-proxy',eastWestM:horizontal,northSouthM:vertical,validated:false}});
  }
  const estimates=kept.filter(c=>c.crownEstimate).map(c=>(c.crownEstimate.eastWestM+c.crownEstimate.northSouthM)/2);
  return{schema:'dendrogeo/park-tree-scan/1',status:completed===total?'unvalidated-candidates':'incomplete',modelId:'tree-detection-fuytu/4',confidence,startedAt,completed,total,candidateCount:kept.length,confirmedTreeCount:null,crownExtentEstimateCount:estimates.length,meanCrownWidthEstimateM:estimates.length?estimates.reduce((a,b)=>a+b,0)/estimates.length:null,crownAreaM2:null,validation:{status:'local-validation-required',confidenceIsAccuracy:false,trainingImageryScaleVerified:false},windowPixels:plan.windowPixels||1024,overlapPixels:plan.overlapPixels||128,pixelSamplingM:distance(root.DG_PARK_TREE_SCAN_PLAN.coordinate(plan.bounds[0],plan.bounds[1],plan.zoom),root.DG_PARK_TREE_SCAN_PLAN.coordinate(plan.bounds[0]+1,plan.bounds[1],plan.zoom)),source:plan.source,attribution:plan.attribution,sourceResolutionM:plan.sourceResolutionM,acquiredAt:null,zoom:plan.zoom,park:plan.park,candidates:kept,limitations:['Single-date imagery candidates, not a verified inventory.','Crown extents are detection-box proxies, not segmented or field-validated crowns.','Tile sampling is not verified native imagery resolution.','Boundary/chip-edge candidates have no crown extent estimate.','Cross-chip duplicate suppression has not been independently validated.']};
 }
 root.DG_PARK_TREE_SCAN_RESULTS=Object.freeze({collect,summarize,distance});
})(window);
