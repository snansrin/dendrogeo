"use strict";
/* Export the selected basemap through the app's existing provider resolver. */
(function(root){
 const attribution={osm:'© OpenStreetMap contributors (ODbL)',sat:'Tiles © Esri — Source: Esri, Maxar, GeoEye, Earthstar Geographics, and the GIS User Community',topo:'© OpenTopoMap (CC-BY-SA) · © OpenStreetMap contributors (ODbL)'};
 function tilePoint(lon,lat,z){const n=2**z,r=Math.max(-85,Math.min(85,lat))*Math.PI/180;return[(lon+180)/360*n,(1-Math.asinh(Math.tan(r))/Math.PI)/2*n];}
 function geo(x,y,z){const n=2**z;return[Math.atan(Math.sinh(Math.PI*(1-2*y/n)))*180/Math.PI,x/n*360-180];}
 function load(url){return new Promise((resolve,reject)=>{const img=new root.Image(),timer=setTimeout(()=>finish(new Error('Harita altlığı yüklenemedi. Bağlantınızı kontrol edip yeniden deneyin.')),15000);function finish(error){clearTimeout(timer);img.onload=img.onerror=null;error?reject(error):resolve(img);}img.crossOrigin='anonymous';img.onload=()=>finish();img.onerror=()=>finish(new Error('Harita altlığı yüklenemedi. Bağlantınızı kontrol edip yeniden deneyin.'));img.src=url;});}
 function paint(g,img,project,x,y,z){
  // Small affine patches preserve the existing UTM projection.
  const steps=4,size=img.naturalWidth/steps;
  for(let row=0;row<steps;row++)for(let col=0;col<steps;col++){
   const a=project(...geo(x+col/steps,y+row/steps,z)),b=project(...geo(x+(col+1)/steps,y+row/steps,z)),c=project(...geo(x+col/steps,y+(row+1)/steps,z));
   g.save();g.transform((b[0]-a[0])/size,(b[1]-a[1])/size,(c[0]-a[0])/size,(c[1]-a[1])/size,a[0],a[1]);g.drawImage(img,col*size,row*size,size,size,0,0,size+.2,size+.2);g.restore();
  }
 }
 async function draw({context,project,parkRings,rect,base='osm',loadImage=load,resolve=root.DG_RESOLVE_BASE_MAP_LAYER?.resolve}){
  const points=parkRings.flat();if(!points.length)throw Error('Park sınırı bulunamadı.');
  const lat=points.reduce((sum,p)=>sum+p[0],0)/points.length,lon=points.reduce((sum,p)=>sum+p[1],0)/points.length;
  const a=project(lat,lon),b=project(lat,lon+.001),c=project(lat+.001,lon),ux=(b[0]-a[0])/.001,uy=(b[1]-a[1])/.001,vx=(c[0]-a[0])/.001,vy=(c[1]-a[1])/.001,det=ux*vy-uy*vx;
  if(!Number.isFinite(det)||Math.abs(det)<1e-10)throw Error('Harita görünümü oluşturulamadı.');
  const corners=[[rect.x,rect.y],[rect.x+rect.width,rect.y],[rect.x,rect.y+rect.height],[rect.x+rect.width,rect.y+rect.height]].map(([x,y])=>[lon+((x-a[0])*vy-(y-a[1])*vx)/det,lat+(ux*(y-a[1])-uy*(x-a[0]))/det]);
  const kind=attribution[base]?base:'osm',config=resolve(kind,attribution);if(!config)throw Error('Harita altlığı bulunamadı.');
  let z=Math.min(config.maxNativeZoom||19,Math.max(0,Math.ceil(Math.log2(360*Math.hypot(ux,uy)/256)))),bounds;
  do{const p=corners.map(([lng,lt])=>tilePoint(lng,lt,z));bounds={left:Math.floor(Math.min(...p.map(q=>q[0])))-1,right:Math.floor(Math.max(...p.map(q=>q[0])))+1,top:Math.floor(Math.min(...p.map(q=>q[1])))-1,bottom:Math.floor(Math.max(...p.map(q=>q[1])))+1};if((bounds.right-bounds.left+1)*(bounds.bottom-bounds.top+1)<=80)break;z--;}while(z>=0);
  const tiles=[];for(let y=bounds.top;y<=bounds.bottom;y++)for(let x=bounds.left;x<=bounds.right;x++)if(y>=0&&y<2**z)tiles.push({x,y});
  // Bounded workers; missing tiles abort instead of producing a blank PNG.
  let cursor=0,failed=false;const images=new Array(tiles.length);
  await Promise.all(Array.from({length:Math.min(6,tiles.length)},async()=>{while(!failed&&cursor<tiles.length){const i=cursor++,{x,y}=tiles[i],wrapped=((x%2**z)+2**z)%2**z;try{images[i]=await loadImage(config.url.replace('{s}','a').replace('{z}',z).replace('{x}',wrapped).replace('{y}',y));}catch(error){failed=true;throw error;}}}));
  context.save();try{context.beginPath();context.rect(rect.x,rect.y,rect.width,rect.height);context.clip();tiles.forEach(({x,y},i)=>paint(context,images[i],project,x,y,z));}finally{context.restore();}
  return attribution[kind];
 }
 root.DG_DRAW_SURFACE_EXPORT_BASEMAP=Object.freeze({draw});
})(window);
