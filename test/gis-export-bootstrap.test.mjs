import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const load=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
function install(overrides={}){
 const window={},notifications=[],errors=[];let handlers;
 vm.runInNewContext(load('src/ui/gis-export-bootstrap.js'),{window});
 const inputs={document:{},window,events:{bind:value=>{handlers=value;}},render:async()=>true,renderVerified:async layers=>layers,
  notify:(...args)=>notifications.push(args),console:{error:(...args)=>errors.push(args)},classes:()=>({}),eachRing:()=>{},...overrides};
 const api=window.DG_GIS_EXPORT_BOOTSTRAP.install(inputs);
 return {window,api,handlers,notifications,errors,inputs};
}
test('bootstrap shares the event and legacy download handlers and preserves layer choices',async()=>{
 const f=install(),layers={surface:true,park:false,grid:true,waypoints:false};
 assert.equal(f.window.downloadParkImage,f.api.download);
 assert.equal(f.handlers.exportMap,f.api.download);
 assert.equal(f.handlers.exportVerified,f.api.downloadVerified);
 assert.equal(f.api.classes,f.inputs.classes);assert.equal(f.api.eachRing,f.inputs.eachRing);
 assert.equal(await f.api.download(),true);
 assert.equal(await f.api.downloadVerified(layers),layers);
});
test('both asynchronous export failures are reported and resolve false',async()=>{
 const failure=new Error('canvas failed');
 const f=install({render:async()=>{throw failure;},renderVerified:async()=>{throw 'NDVI failed';}});
 assert.equal(await f.api.download(),false);assert.equal(await f.api.downloadVerified({}),false);
 assert.equal(f.errors.length,2);assert.equal(f.errors[0][1],failure);
 assert.deepEqual(f.notifications,[['PNG oluşturulamadı: canvas failed','err'],['NDVI doğrulanmış haritası üretilemedi: NDVI failed','err']]);
});
test('bootstrap loads before the adapter and remains available offline',()=>{
 const html=load('index.html'),sw=load('sw.js');
 assert.ok(html.indexOf('src/ui/gis-export-bootstrap.js')<html.indexOf('src/ui/gis-export.js'));
 assert.match(html,/src\/ui\/gis-export-bootstrap\.js\?v=[a-f0-9]{8}/);
 assert.match(sw,/\/src\/ui\/gis-export-bootstrap\.js/);
});
