import {test} from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const load=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
function fixture(){
 const bound={},state={};const window={DG_GIS_EXPORT_PLATFORM:{create:()=>({read:()=>({value:'7'}),notify:()=>{}})},
  DG_GIS_EXPORT_SOURCES:{create:inputs=>{bound.sources=inputs;return {}; }},DG_GIS_EXPORT_PRESENTATION:{classes:read=>read()},
  DG_GIS_EXPORT_WORKFLOW:{create:inputs=>{bound.standard=inputs;return {render:async()=>true};}},
  DG_GIS_EXPORT_VERIFIED_WORKFLOW:{create:inputs=>{bound.verified=inputs;return {renderVerified:async()=>true};}},
  DG_GIS_EXPORT_BOOTSTRAP:{install:inputs=>{bound.install=inputs;window.DG_GIS_PNG_EXPORT={download:inputs.render,downloadVerified:inputs.renderVerified};}},
  DG_GIS_EXPORT_VEGETATION:{waitForLayers:(sens,options)=>{bound.wait={sens,options};return [];}},DG_PARK_IMAGE_GEOMETRY:{appendRing:args=>{bound.ring=args;}},DG_GIS_EXPORT_CANVAS:{eachRing:(tree,visit)=>visit(tree)}};
 const ports={getToast:()=>null,getClasses:()=>state.classes,getVegetationColors:()=>state.colors,getTiersFunction:()=>state.tiers,getVegetationRenderer:()=>state.renderer,getParkRings:()=>state.rings,getSensitivity:()=>state.sensitivity};
 vm.runInNewContext(load('src/bootstrap/gis-export.js'),{window});const api=window.DG_START_GIS_EXPORT.start({document:{},window,console,ports});return {window,api,bound,state,ports};
}
test('composition shares dependencies and installs both existing download APIs',async()=>{
 const f=fixture();assert.equal(f.bound.standard.sources,f.bound.verified.sources);assert.equal(f.bound.standard.platform,f.bound.verified.platform);
 assert.equal(f.bound.standard.classes,f.bound.verified.classes);assert.equal(f.bound.standard.getParkRings,f.ports.getParkRings);
 assert.equal(f.api,f.window.DG_GIS_PNG_EXPORT);assert.equal(await f.api.download(),true);assert.equal(await f.api.downloadVerified(),true);
 assert.equal(f.bound.sources.readProjectId(),7);
});
test('composition resolves classes and NDVI helpers after startup',()=>{
 const f=fixture();f.state.classes=[{key:'water'}];assert.equal(f.bound.install.classes(),f.state.classes);
 f.state.tiers=()=>({count:9});f.state.renderer=()=>{};const sens={vegetationView:true};f.bound.standard.waitVegetation(sens,30);
 assert.equal(f.bound.wait.sens,sens);assert.equal(f.bound.wait.options.attempts,30);assert.equal(f.bound.wait.options.tiers,f.state.tiers);assert.equal(f.bound.wait.options.render,f.state.renderer);
});
test('composition preserves undefined and explicitly null vegetation palette behavior',()=>{
 const f=fixture();assert.equal(f.bound.standard.getVegetationColors().dense,'#166534');assert.equal(f.bound.verified.getVegetationColors(),null);
 f.state.colors=null;assert.equal(f.bound.standard.getVegetationColors(),null);f.state.colors={dense:'custom'};assert.equal(f.bound.standard.getVegetationColors(),f.state.colors);
});
test('geometry bridge skips empty rings and accepts both projector interfaces',()=>{
 const f=fixture();f.bound.standard.outline({}, {}, []);assert.equal(f.bound.ring,undefined);
 const ring=[[1,2]],x=()=>1,y=()=>2;f.bound.standard.outline({}, {x,y},ring);assert.equal(f.bound.ring.ring,ring);assert.equal(f.bound.ring.projector.X,x);assert.equal(f.bound.ring.projector.Y,y);
});
test('composition root loads before legacy bindings and is precached',()=>{
 const html=load('index.html');assert.ok(html.indexOf('src/bootstrap/gis-export.js')<html.indexOf('src/ui/gis-export.js'));
 assert.match(html,/src\/bootstrap\/gis-export\.js\?v=[a-f0-9]{8}/);assert.match(load('sw.js'),/\/src\/bootstrap\/gis-export\.js/);
});
