/* Leaflet polygon ring traversal and Canvas rendering for GIS PNG exports. */
(function(root){
 "use strict";
 function eachRing(tree,visit){
  if(!Array.isArray(tree)||!tree.length)return;
  if(tree[0]&&typeof tree[0].lat==="number"&&typeof tree[0].lng==="number"){visit(tree);return;}
  for(const child of tree)eachRing(child,visit);
 }
 function drawLeaflet(context,projector,layer,opacity=0.6){
  const rings=[];
  if(typeof layer?.getLatLngs!=="function")return false;
  eachRing(layer.getLatLngs(),ring=>rings.push(ring));
  if(!rings.length)return false;
  context.beginPath();
  for(const ring of rings){
   ring.forEach((point,index)=>{
    const x=projector.x(point.lng),y=projector.y(point.lat);
    if(index===0)context.moveTo(x,y);else context.lineTo(x,y);
   });
   context.closePath();
  }
  context.fillStyle=layer.options?.fillColor||layer.options?.color||"#94a3b8";
  context.globalAlpha=Math.min(1,Math.max(0,opacity));
  context.fill("evenodd");
  context.globalAlpha=1;
  return true;
 }
 root.DG_GIS_EXPORT_CANVAS_LEAFLET=Object.freeze({eachRing,drawLeaflet});
})(window);
