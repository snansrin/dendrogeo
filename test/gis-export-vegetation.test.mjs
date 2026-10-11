import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const context=vm.createContext({window:{}});
vm.runInContext(readFileSync(new URL('../src/ui/gis-export-vegetation.js',import.meta.url),'utf8'),context);
const vegetation=context.window.DG_GIS_EXPORT_VEGETATION;

test('NDVI export is unavailable when vegetation view or minimum tier count is missing',async()=>{
 let renderCalls=0;
 assert.equal((await vegetation.waitForLayers({vegetationView:false},{render:()=>renderCalls++})).length,0);
 assert.equal((await vegetation.waitForLayers({vegetationView:true},{tiers:()=>({count:8}),render:()=>renderCalls++})).length,0);
 assert.equal(renderCalls,0);
});

test('visible Leaflet polygons are reused before requesting a render',async()=>{
 const layer={getLatLngs:()=>[]};let renderCalls=0;
 const sens={vegetationView:true,vegetationLayer:{eachLayer:fn=>{fn(layer);fn({});}}};
 const ready=await vegetation.waitForLayers(sens,{tiers:()=>({count:9}),render:()=>renderCalls++});
 assert.equal(ready.length,1);assert.equal(ready[0],layer);assert.equal(renderCalls,0);
});

test('missing polygons trigger one render and bounded readiness polling',async()=>{
 let available=false,renderCalls=0,waitCalls=0;
 const layer={getLatLngs:()=>[]};
 const sens={vegetationView:true,vegetationLayer:{eachLayer:fn=>{if(available)fn(layer);}}};
 const ready=await vegetation.waitForLayers(sens,{attempts:3,render:async()=>{renderCalls++;},pause:async()=>{waitCalls++;if(waitCalls===2)available=true;}});
 assert.equal(renderCalls,1);assert.equal(waitCalls,2);assert.equal(ready[0],layer);
});

test('render failure still returns empty after the configured bounded wait',async()=>{
 let waitCalls=0;
 const sens={vegetationView:true,vegetationLayer:{eachLayer:()=>{}}};
 const ready=await vegetation.waitForLayers(sens,{attempts:2,render:async()=>{throw Error('worker unavailable');},pause:async()=>{waitCalls++;}});
 assert.equal(ready.length,0);assert.equal(waitCalls,2);
});
