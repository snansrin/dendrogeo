import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('basemaps preserve historical interaction ceilings and provider native resolution',()=>{
 const window={};vm.runInNewContext(read('src/domain/map/resolve-base-map-layer.js'),{window});
 for(const [type,zoom] of [['osm',19],['sat',23],['topo',17]]){
  const config=window.DG_RESOLVE_BASE_MAP_LAYER.resolve(type,{});
  assert.equal(config.maxNativeZoom,zoom);assert.equal(config.maxZoom,type==="sat"?23:22);
 }
});
test('missing imagery preserves the view and zoom ceiling; only a new area retries native tiles',()=>{
 const window={};vm.runInNewContext(read('src/adapters/map/create-base-map-layer.js'),{window});
 let center={lat:39.99,lng:32.62},zoom=20,ceiling=23,move,off=false;const events={};
 const map={getCenter:()=>center,on:(_,handler)=>{move=handler;},off:()=>{off=true;},setMaxZoom:value=>{ceiling=value;if(zoom>ceiling){zoom=ceiling;move?.();}}};
 const leaflet={tileLayer:(_url,options)=>({options,on:(event,handler)=>{events[event]=handler;},redraw(){},addTo(){}})};
 const layer=window.DG_CREATE_BASE_MAP_LAYER.create({leaflet,map,configuration:{url:'sat',type:'sat',maxZoom:23,maxNativeZoom:23}});
 events.tileerror({coords:{z:20}});
 assert.equal(zoom,20);assert.equal(ceiling,23);assert.equal(layer.options.maxZoom,23);
 move();assert.equal(ceiling,23);assert.equal(layer.options.maxNativeZoom,19);
 center={lat:40.1,lng:32.62};move();assert.equal(ceiling,23);assert.equal(zoom,20);
 events.remove();assert.equal(off,true);
});
