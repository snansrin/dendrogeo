import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
function setup(){const window={};for(const file of ['src/domain/map/resolve-base-map-layer.js','src/ui/draw-surface-export-basemap.js'])vm.runInNewContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),{window,setTimeout,clearTimeout});return window;}
function args(){let painted=0;const transforms=[],clips=[];return{context:{save(){},restore(){},beginPath(){},rect(){},moveTo(){},lineTo(){},closePath(){},clip(rule){clips.push(rule);},transform(...values){transforms.push(values);},drawImage(){painted++;}},project:(lat,lon)=>[(lon-32)*80000+(lat-40)*500,-(lat-40)*100000+(lon-32)*600],parkRings:[[[40,32],[40.01,32],[40.01,32.01],[40,32.01]]],rect:{x:0,y:-1000,width:1000,height:1000},painted:()=>painted,transforms,clips};}
for(const base of ['osm','sat','topo'])test(base+' tiles use existing provider, bounded concurrency and finite projection',async()=>{
 const window=setup(),input=args(),urls=[];let active=0,maxActive=0;
 const attribution=await window.DG_DRAW_SURFACE_EXPORT_BASEMAP.draw({...input,base,loadImage:async url=>{urls.push(url);active++;maxActive=Math.max(maxActive,active);await new Promise(resolve=>setTimeout(resolve,1));active--;return{naturalWidth:256};}});
 assert.ok(urls.length>0&&urls.length<=80);assert.ok(maxActive<=6);assert.equal(input.painted(),urls.length,'whole tiles have no subdivision grid');assert.deepEqual(input.clips,[undefined,'evenodd']);assert.ok(input.transforms.flat().every(Number.isFinite));assert.ok(attribution.includes(base==='sat'?'Esri':base==='topo'?'OpenTopoMap':'OpenStreetMap'));assert.ok(urls.every(url=>!url.includes('{')));
});
test('tile failure produces no partial map and empty park is rejected',async()=>{
 const window=setup(),input=args();await assert.rejects(window.DG_DRAW_SURFACE_EXPORT_BASEMAP.draw({...input,loadImage:async()=>{throw Error('unavailable');}}),/unavailable/);assert.equal(input.painted(),0);
 await assert.rejects(window.DG_DRAW_SURFACE_EXPORT_BASEMAP.draw({...input,parkRings:[]}),/Park sınırı/);
});
