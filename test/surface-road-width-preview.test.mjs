import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import polygonClipping from 'polygon-clipping';
function setup(){
 const context=vm.createContext({window:{polygonClipping},setTimeout,console});
 for(const path of ['src/services/lc-geo.js','src/contracts/surface-review.js','src/adapters/surface/review-store.js','src/domain/surface/review-geometry.js','src/adapters/surface/osm-review-objects.js','src/adapters/surface/review-worker.js','src/application/surface/prepare-review.js','src/application/surface/merge-review-features.js','src/services/lc-review.js','src/domain/surface/osm-road-width-preview.js','src/application/surface/preview-surface-road-width.js','src/ui/surface-road-width-control.js','src/application/surface/apply-auto-surface-water-objects.js'])vm.runInContext(readFileSync(new URL('../'+path,import.meta.url),'utf8'),context);
 const xy=(x,y)=>{const p=context.dgLcUtmInverse(500000+x,1000+y,32631);return[p.lon,p.lat];};
 const source={type:'way',id:1456490807,tags:{highway:'footway'},geometry:[xy(0,10),xy(20,10)].map(([lon,lat])=>({lon,lat}))};
 const feature=context.dgSurfaceObjects([source],32631)[0];
 const api=context.window.DG_OSM_ROAD_WIDTH_PREVIEW,preview=api.attach(feature,[source]);
 const park=[[[[-1,0],[21,0],[21,20],[-1,20],[-1,0]].map(([x,y])=>[500000+x,1000+y])]];
 const build=width=>api.build({preview,width,epsg:32631,park,objects:context.dgSurfaceObjects,geometry:context.dgSurfaceFeatureGeometry,clip:context.dgSurfaceClip,area:context.dgSurfaceArea,unproject:context.dgSurfaceUnproject});
 return{context,api,preview,source,build,park};
}
test('metric road widening uses real buffered geometry, clips at the park and leaves source unchanged',()=>{
 const {context:c,source,preview,build}=setup(),before=JSON.stringify({source,preview});
 const next=build(8),area=c.dgSurfaceArea(c.dgSurfaceFeatureGeometry(next,32631));
 assert.ok(area>170&&area<177,`22 m clipped corridor at 8 m width: ${area}`);
 assert.equal(next.roadWidthM,8);assert.equal(JSON.stringify({source,preview}),before);
 assert.throws(()=>build(1),/Sınır çiz/);for(const value of ['',0,-1,61,'abc'])assert.throws(()=>build(value));
});
test('areas and buildings do not receive a centreline width control',()=>{
 const {api,preview,source}=setup();
 for(const tags of [{highway:'footway',area:'yes'},{highway:'footway','area:highway':'footway'}])assert.equal(api.attach({...preview,roadSource:undefined},[{...source,tags}]).roadSource,undefined);
 assert.equal(api.attach({type:'building',osmId:preview.osmId},[source]).roadSource,undefined);
});
test('preview staging never writes analysis records and invalid widths preserve the current preview',()=>{
 const {context:c,preview,build}=setup(),record={acceptedResult:{areas:{hard:12}}},state={objectPreview:preview,record},before=JSON.stringify(record),errors=[];
 const ports={state,width:8,build:(_,width)=>build(width),render:()=>({}),remove(){},renderTools(){},report:message=>errors.push(message)};
 assert.equal(c.window.DG_PREVIEW_SURFACE_ROAD_WIDTH.update(ports),true);assert.equal(JSON.stringify(record),before);
 const current=state.objectPreview;assert.equal(c.window.DG_PREVIEW_SURFACE_ROAD_WIDTH.update({...ports,width:-1}),false);assert.equal(state.objectPreview,current);assert.equal(errors.length,1);
 state.rawView=true;assert.equal(c.window.DG_PREVIEW_SURFACE_ROAD_WIDTH.update(ports),false);
});
test('explicit road correction remains a manual decision during a later OSM refresh',async()=>{
 const {context:c,api,build}=setup(),preview=build(8),manual=api.decision({type:'hard',method:'visual-boundary',osmId:preview.osmId,geometry:preview.geometry},preview);
 assert.equal(manual.source,'user-road-width');assert.equal(manual.roadWidthM,8);
 const record={features:[manual],objectFeatures:[],osmCoverage:{status:'complete'}},objects=[{type:'hard',method:'osm-boundary',osmId:preview.osmId,geometry:preview.geometry}];
 await c.window.DG_APPLY_AUTO_SURFACE_WATER_OBJECTS.apply({record,objects,epoch:1,getEpoch:()=>1,getRecord:()=>record,repartition:async features=>{record.features=features;return true;},dirty(){}});
 assert.equal(record.features[0],manual);
});
