"use strict";
(function(root){
/* Shared candidate normalization; no inference or accepted-data mutation. */
const labels=new Set(['Tree','objects-tree','tree-top']);
const finite=value=>typeof value==='number'&&Number.isFinite(value);
function intersectionOverUnion(a,b){
 const width=Math.max(0,Math.min(a[2],b[2])-Math.max(a[0],b[0]));
 const height=Math.max(0,Math.min(a[3],b[3])-Math.max(a[1],b[1]));
 const intersection=width*height;
 return intersection/((a[2]-a[0])*(a[3]-a[1])+(b[2]-b[0])*(b[3]-b[1])-intersection||1);
}
function buildTreeDetectionPilot(predictions,metadata,options={}){
 const {confidence,nmsIou}=options;
 if(!finite(confidence)||confidence<0||confidence>1||!finite(nmsIou)||nmsIou<=0||nmsIou>1)throw Error('Explicit pilot confidence (0–1) and NMS IoU (0–1, excluding 0) are required.');
 const {width,height,imageId,modelId}=metadata||{};
 if(!Number.isSafeInteger(width)||width<=0||!Number.isSafeInteger(height)||height<=0||typeof imageId!=='string'||!imageId.trim()||typeof modelId!=='string'||!modelId.trim())throw Error('Image ID, model ID and original image dimensions are required.');
 if(modelId!=='tree-detection-fuytu/4')throw Error('The pilot label mapping is reviewed only for tree-detection-fuytu/4.');
 const rows=predictions?.predictions;
 if(!Array.isArray(rows)||rows.length>5000)throw Error('Expected at most 5,000 prediction rows from one original image.');
 if(predictions.image&&(predictions.image.width!==width||predictions.image.height!==height))throw Error('Prediction image size differs from the original metadata; resize/letterbox transforms must be resolved first.');
 const counts={unknownLabels:0,belowThreshold:0,duplicates:0,outsideImage:0};
 const candidates=[];
 for(let index=0;index<rows.length;index++){
  const row=rows[index];
  if(!row||![row.x,row.y,row.width,row.height,row.confidence].every(finite)||row.width<=0||row.height<=0||row.confidence<0||row.confidence>1)throw Error('Invalid prediction row '+index);
  if(!labels.has(row.class)){counts.unknownLabels++;continue;}
  if(row.confidence<confidence){counts.belowThreshold++;continue;}
  const box=[row.x-row.width/2,row.y-row.height/2,row.x+row.width/2,row.y+row.height/2];
  // Partial image-edge detections are retained as partial candidates, not enlarged.
  const clipped=[Math.max(0,box[0]),Math.max(0,box[1]),Math.min(width,box[2]),Math.min(height,box[3])];
  if(clipped[0]>=clipped[2]||clipped[1]>=clipped[3]){counts.outsideImage++;continue;}
  candidates.push({sourceIndex:index,label:row.class,confidence:row.confidence,boxPixels:clipped,partial:box.some((v,i)=>v!==clipped[i]),reviewState:'candidate',crownAreaM2:null,crownDiameterM:null,species:null});
 }
 candidates.sort((a,b)=>b.confidence-a.confidence||a.sourceIndex-b.sourceIndex);
 const kept=[];
 // One label family for this pilot only; cross-label suppression needs field review.
 for(const candidate of candidates){if(kept.some(other=>intersectionOverUnion(candidate.boxPixels,other.boxPixels)>=nmsIou)){counts.duplicates++;continue;}kept.push(candidate);}
 return{schema:'dendrogeo/tree-detection-pilot/1',status:'unvalidated-candidates',imageId,modelId,image:{width,height},settings:{confidence,nmsIou},candidateCount:kept.length,confirmedTreeCount:null,counts,candidates:kept,limitations:['Single-image box detections; not a complete park count.','No crown mask or calibrated ground geometry; crown metrics are intentionally absent.','Cross-image/tile duplicates, park clipping and local accuracy have not been evaluated.']};
}

root.DG_TREE_DETECTION_RESULTS=Object.freeze({build:buildTreeDetectionPilot});
})(typeof window!=="undefined"?window:globalThis);
