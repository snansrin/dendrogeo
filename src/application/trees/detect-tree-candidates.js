"use strict";
(function(root){
 function create({getPark,plan,readImage,clearImages,infer,collect,summarize,present,makeAbortController,clock,yieldFrame}){
  let epoch=0,pending=null,scan=null,rows=[],completed=0,result=null,state='empty',error=null,confidence=.5,startedAt=null,windowPixels=1024;
  const samePark=()=>scan&&JSON.stringify(getPark())===scan.key;
  function display(){if(scan)result=summarize(rows,scan,confidence,{completed,total:scan.chips.length,startedAt});present({state,error,result,confidence,parkReady:!!getPark()?.outer?.length,windowPixels,completed,total:scan?.chips.length||0});}
  function clear(){epoch++;pending?.abort();pending=null;clearImages();scan=null;rows=[];completed=0;result=null;error=null;state='empty';display();}
  function contextChanged(){if(scan&&!samePark())clear();else if(!scan)display();}
  function setThreshold(value){if(!Number.isFinite(value)||value<0||value>1)return;confidence=value;display();}
  function setWindowPixels(value){if(![768,1024,1536].includes(value)||value===windowPixels)return;windowPixels=value;clear();}
  function cancel(){epoch++;pending?.abort();pending=null;clearImages();error='cancelled';state=scan?'cancelled':'empty';display();}
  async function run(){
   if(pending)return;
   clear();const job=epoch;startedAt=clock();
   try{scan=plan(getPark(),{size:windowPixels});}catch(e){state='error';error=e.message;display();return;}
   pending=makeAbortController();state='running';display();const signal=pending.signal;
   try{for(const chip of scan.chips){
    if(job!==epoch)return;if(!samePark()){clear();return;}
    const image=await readImage(chip,signal);if(job!==epoch)return;chip.imageSha256=image.imageSha256||null;chip.retrievedAt=clock();
    // Fetch all model confidences once; the slider filters locally without a new request.
    const raw=await infer(image,0,signal);if(job!==epoch)return;if(!samePark()){clear();return;}
    const additions=collect(raw,chip);if(rows.length+additions.length>12000)throw Error('too_many_candidates');rows.push(...additions);chip.modelCompleted=true;completed++;display();await yieldFrame();
   }
   if(job===epoch){state='complete';display();}
   }catch(e){if(job===epoch){state='error';error=e.name==='AbortError'?'cancelled':e.message;display();}}
   finally{if(job===epoch){pending=null;clearImages();}}
  }
  function exportResult(){if(!result||!scan)return null;return{...result,reviewData:{schema:'dendrogeo/tree-scan-review/1',independentlyValidated:false,normalization:'Tree label mapping, image clipping and per-image NMS; not raw provider output.',windows:scan.chips.map(chip=>({id:chip.id,x:chip.x,y:chip.y,width:chip.width,height:chip.height,zoom:chip.zoom,imageSha256:chip.imageSha256||null,retrievedAt:chip.retrievedAt||null,modelCompleted:!!chip.modelCompleted})),normalizedCandidatesBeforeConfidence:rows.map(row=>({chipId:row.chipId,label:row.label,confidence:row.confidence,boxPixels:row.boxPixels,globalBox:row.globalBox,edge:row.edge})),referenceAnnotations:[]}};}
  return Object.freeze({run,cancel,clear,setThreshold,setWindowPixels,contextChanged,exportResult});
 }
 root.DG_DETECT_TREE_CANDIDATES=Object.freeze({create});
})(window);
