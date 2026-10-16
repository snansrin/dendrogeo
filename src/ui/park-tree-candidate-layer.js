"use strict";
/* A single pointer-transparent canvas preserves brush/drawing events and cheap filtering. */
(function(root){
 function create({getMap,leaflet}){
  let layer=null;
  const CandidateLayer=leaflet.Layer.extend({
   options:{interactive:false},_dgTreeCandidates:true,
   onAdd(map){this.owner=map;this.canvas=document.createElement('canvas');this.canvas.className='leaflet-zoom-hide';this.canvas.style.pointerEvents='none';this.canvas.style.position='absolute';this.canvas.setAttribute('aria-hidden','true');map.getPane('overlayPane').append(this.canvas);map.on('move zoomend resize',this.schedule,this);this.draw();},
   onRemove(map){map.off('move zoomend resize',this.schedule,this);if(this.frame)cancelAnimationFrame(this.frame);this.canvas.remove();this.owner=null;},
   schedule(){if(!this.frame)this.frame=requestAnimationFrame(()=>{this.frame=null;this.draw();});},
   draw(){
    if(!this.owner)return;const size=this.owner.getSize(),ratio=Math.min(2,window.devicePixelRatio||1),canvas=this.canvas;canvas.width=Math.round(size.x*ratio);canvas.height=Math.round(size.y*ratio);canvas.style.width=size.x+'px';canvas.style.height=size.y+'px';leaflet.DomUtil.setPosition(canvas,this.owner.containerPointToLayerPoint([0,0]));
    const context=canvas.getContext('2d');context.setTransform(ratio,0,0,ratio,0,0);context.strokeStyle='#c77d2e';context.fillStyle='#c77d2e';context.lineWidth=1.5;context.setLineDash(this.result?.status==='incomplete'?[3,4]:[]);
    for(const candidate of this.result?.candidates.slice(0,2000)||[]){context.beginPath();candidate.corners.forEach((point,index)=>{const p=this.owner.latLngToContainerPoint(point);if(index)context.lineTo(p.x,p.y);else context.moveTo(p.x,p.y);});context.closePath();context.stroke();const center=this.owner.latLngToContainerPoint(candidate.center);context.fillRect(center.x-1.5,center.y-1.5,3,3);}
   }
  });
  function clear(){if(layer)layer.remove();layer=null;}
  function show(result){const map=getMap();if(!map||!result){clear();return;}if(!layer||layer.owner!==map){clear();layer=new CandidateLayer();layer.result=result;layer._dgTreeCount=Math.min(2000,result.candidateCount);layer.addTo(map);}else{layer.result=result;layer._dgTreeCount=Math.min(2000,result.candidateCount);layer.schedule();}}
  return Object.freeze({show,clear,focus:candidate=>{if(candidate)getMap()?.panTo(candidate.center);}});
 }
 root.DG_PARK_TREE_CANDIDATE_LAYER=Object.freeze({create});
})(window);
