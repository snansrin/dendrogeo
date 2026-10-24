"use strict";
/* Paint selected reviewed geometries and field layers into the export map. */
(function(root){
 function draw({context,layers,displayFeatures,project,parkRings,gridCells,waypoints,colors,ink}){
  const g=context;
  for(const feature of layers.surface?displayFeatures:[]){g.beginPath();for(const poly of feature.geometry.coordinates)for(const ring of poly){ring.forEach((q,i)=>{const p=project(q[1],q[0]);i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]);});g.closePath();}g.fillStyle=colors[feature.properties.class]||colors.other;g.fill("evenodd");}
  if(layers.park)for(const ring of parkRings||[]){g.beginPath();let first=true;for(const q of ring){const p=project(q[0],q[1]);first?g.moveTo(p[0],p[1]):g.lineTo(p[0],p[1]);first=false;}g.closePath();g.strokeStyle=/^#[0-9a-f]{6}$/i.test(layers.boundaryColor||'')?layers.boundaryColor:'#111827';g.lineWidth=2.5;g.stroke();}
  if(layers.grid)for(const cell of gridCells||[])for(const poly of cell.geometry?.coordinates||[])for(const ring of poly){g.beginPath();ring.forEach((q,i)=>{const p=project(q[1],q[0]);i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]);});g.closePath();g.strokeStyle="#14532d";g.lineWidth=1;g.stroke();}
  if(layers.waypoints)for(const waypoint of waypoints){const p=project(Number(waypoint.lat),Number(waypoint.lon));g.beginPath();g.arc(p[0],p[1],7,0,Math.PI*2);g.fillStyle=waypoint.visited?"#22c55e":"#ef4444";g.fill();g.strokeStyle="#fff";g.lineWidth=2;g.stroke();g.fillStyle=ink;g.font="bold 14px Arial";g.fillText(String(waypoint.wp_id??waypoint.id??""),p[0]+10,p[1]+4);}
 }
 root.DG_DRAW_SURFACE_EXPORT_MAP_LAYERS=Object.freeze({draw});
})(window);
