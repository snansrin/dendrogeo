/* Local, offline box evaluation. No model requests, account data or production writes. */
function validBox(box,width,height){return Array.isArray(box)&&box.length===4&&box.every(Number.isFinite)&&box[0]>=0&&box[1]>=0&&box[2]>box[0]&&box[3]>box[1]&&box[2]<=width&&box[3]<=height;}
function iou(a,b){const area=b=>(b[2]-b[0])*(b[3]-b[1]),n=Math.max(0,Math.min(a[2],b[2])-Math.max(a[0],b[0]))*Math.max(0,Math.min(a[3],b[3])-Math.max(a[1],b[1]));return n/(area(a)+area(b)-n);}
export function evaluateTreeDataset(data,{thresholds=[.1,.2,.3,.4,.5,.6,.7,.8,.9],iouThreshold=.5}={}){
 if(data?.schema!=='dendrogeo/tree-validation/1'||!Array.isArray(data.images)||!data.images.length||data.images.length>2000)throw Error('Expected tree-validation/1 images (1–2000).');
 if(!Number.isFinite(iouThreshold)||iouThreshold<=0||iouThreshold>1||!Array.isArray(thresholds)||!thresholds.length||thresholds.some(t=>!Number.isFinite(t)||t<0||t>1))throw Error('Invalid evaluation thresholds.');
 const ids=new Set(),parkSplits=new Map();
 for(const image of data.images){
  if(typeof image.id!=='string'||!image.id.trim()||ids.has(image.id)||typeof image.parkId!=='string'||!image.parkId.trim()||!['calibration','test'].includes(image.split)||!Number.isSafeInteger(image.width)||image.width<=0||!Number.isSafeInteger(image.height)||image.height<=0||!Array.isArray(image.groundTruth)||!Array.isArray(image.predictions)||image.groundTruth.length>5000||image.predictions.length>5000)throw Error('Invalid or duplicate image.');
  ids.add(image.id);if(parkSplits.has(image.parkId)&&parkSplits.get(image.parkId)!==image.split)throw Error('Park leakage between calibration and test splits.');parkSplits.set(image.parkId,image.split);
  if(!image.exhaustivelyAnnotated||typeof image.annotationSource!=='string'||!image.annotationSource.trim())throw Error('Exhaustive independent reference annotations are required, including empty images.');
  if([...image.groundTruth,...image.predictions].some(row=>!validBox(row.box,image.width,image.height))||image.predictions.some(row=>!Number.isFinite(row.confidence)||row.confidence<0||row.confidence>1))throw Error('Invalid pixel box or confidence.');
 }
 const partitions={calibration:data.images.filter(x=>x.split==='calibration'),test:data.images.filter(x=>x.split==='test')};
 if(!partitions.calibration.length||!partitions.test.length)throw Error('Separate calibration and held-out test parks are required.');
 function score(images,threshold){let tp=0,fp=0,fn=0,error=0,bias=0;const perImage=[];
  for(const image of images){const predictions=image.predictions.filter(p=>p.confidence>=threshold).sort((a,b)=>b.confidence-a.confidence),matched=new Set();let hit=0;
   for(const prediction of predictions){let best=-1,bestIou=iouThreshold;for(let i=0;i<image.groundTruth.length;i++){if(matched.has(i))continue;const value=iou(prediction.box,image.groundTruth[i].box);if(value>=bestIou){best=i;bestIou=value;}}if(best>=0){matched.add(best);hit++;}}
   const row={id:image.id,parkId:image.parkId,tp:hit,fp:predictions.length-hit,fn:image.groundTruth.length-hit,predicted:predictions.length,reference:image.groundTruth.length};perImage.push(row);tp+=row.tp;fp+=row.fp;fn+=row.fn;error+=Math.abs(row.predicted-row.reference);bias+=row.predicted-row.reference;
  }
  const precision=tp+fp?tp/(tp+fp):null,recall=tp+fn?tp/(tp+fn):null,f1=2*tp+fp+fn?2*tp/(2*tp+fp+fn):null;
  return{threshold,tp,fp,fn,precision,recall,f1,countMae:error/images.length,countBias:bias/images.length,imageCount:images.length,perImage};
 }
 const calibration=[...new Set(thresholds)].map(t=>score(partitions.calibration,t)).sort((a,b)=>(b.f1??-1)-(a.f1??-1)||a.countMae-b.countMae||b.threshold-a.threshold),selectedThreshold=calibration[0].threshold;
 return{schema:'dendrogeo/tree-validation-results/1',modelId:data.modelId||null,iouThreshold,selectedThreshold,selection:'Calibration F1; then count MAE; then higher threshold. Test set is never used for selection.',calibration,test:score(partitions.test,selectedThreshold),productionApproved:false,limitations:['Box matching at one IoU threshold; not COCO mAP or crown-mask validation.','Reference annotation quality and source imagery licenses require independent review.','A score does not automatically authorize inventory or surface writes.']};
}
