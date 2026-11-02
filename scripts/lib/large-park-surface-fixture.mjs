import assert from 'node:assert/strict';
export async function checkLargeParkSurface(browser,server){
 for(const width of [360,390,430,1280]){
  const page=await browser.newPage({viewport:{width,height:900},serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/large-park-surface-fixture',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/vendor/leaflet-1.9.4.css"><style>body{margin:0}#map{height:600px;width:100%}</style><div id="map"></div><script src="/vendor/leaflet-1.9.4.js"></script><script src="/vendor/polygon-clipping-0.15.7.js"></script><script src="/src/application/surface/merge-review-features.js"></script>'}));
  await page.goto(server.url+'/large-park-surface-fixture');
  const result=await page.evaluate(()=>{
   const parts=Array.from({length:150000},(_,i)=>{const x=-.2+i%500*.00001,y=51.5+Math.floor(i/500)*.00001;return{type:'green',geom:[[[[x,y],[x+.00001,y],[x+.00001,y+.00001],[x,y+.00001],[x,y]]]],areaM2:100,method:'review-cell'};});
   let max=0;const output=DG_SURFACE_REVIEW_FEATURES.create({union:g=>{max=Math.max(max,g.length);return polygonClipping.union(...g);},unproject:g=>g});
   const features=output.merge(parts,32630),map=L.map('map'),layer=L.geoJSON(features,{style:{fillColor:'#22c55e',fillOpacity:.45}}).addTo(map);map.fitBounds(layer.getBounds());
   return{area:features[0].properties.area_m2,paths:document.querySelectorAll('#map svg path').length,max,overflow:document.documentElement.scrollWidth>innerWidth};
  });
  assert.equal(result.area,15000000);assert.ok(result.paths>0);assert.ok(result.max<=128);assert.equal(result.overflow,false);assert.deepEqual(errors,[]);console.log(JSON.stringify({width,largeSurface:result}));await page.close();
 }
}
