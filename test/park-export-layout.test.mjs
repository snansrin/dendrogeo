import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/ui/park-export-layout.js',import.meta.url),'utf8');
const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
const context=vm.createContext({window:{}});
vm.runInContext(source,context);
const layout=context.window.DG_PARK_EXPORT_LAYOUT;

test('park PNG layout preserves buffered bounds, metric fit, and canvas frame',()=>{
 let projectionInput;
 const result=layout.compute({outer:[[[40,32],[40.01,32],[40.01,32.02],[40,32.02]]],
  holes:[[[40.004,32.004],[40.006,32.004],[40.006,32.006],[40.004,32.006]]],
  project:input=>(projectionInput=input,{x:'projected'})});
 assert.ok(result.minLat<40&&result.maxLat>40.01);
 assert.ok(result.minLon<32&&result.maxLon>32.02);
 assert.equal(result.PAD,70);assert.equal(result.LEGH,132);assert.equal(result.Htop,116);
 assert.ok(result.W>=960);assert.ok(result.H>result.Htop+result.PAD+result.LEGH);
 assert.equal(result.projector.x,'projected');
 assert.equal(projectionInput.width,result.W);assert.equal(projectionInput.heightTop,result.Htop);
 assert.equal(projectionInput.scale,result.scale);
});

test('park PNG bounds include hole rings and preserve the 15 metre edge buffer',()=>{
 const result=layout.compute({outer:[[[10,20],[11,21]]],holes:[[[12,22]]],project:()=>({})});
 assert.ok(Math.abs((result.minLat-(10-15/110540)))<1e-12);
 assert.ok(Math.abs((result.maxLat-(12+15/110540)))<1e-12);
 const lonBuffer=15/(111320*Math.cos(11*Math.PI/180));
 assert.ok(Math.abs(result.minLon-(20-lonBuffer))<1e-12);
 assert.ok(Math.abs(result.maxLon-(22+lonBuffer))<1e-12);
});

test('missing park rings do not ask the image projector for a frame',()=>{
 const project=()=>{throw Error('must not project missing bounds');};
 assert.equal(layout.compute({outer:[],holes:[],project}),null);
});

test('park PNG layout loads before its adapter and is included in offline cache',()=>{
 assert.ok(index.indexOf('src/ui/park-image-geometry.js')<index.indexOf('src/ui/park-export-layout.js'));
 assert.ok(index.indexOf('src/ui/park-export-layout.js')<index.indexOf('src/ui/park-export.js'));
 assert.match(index,/src\/ui\/park-export-layout\.js\?v=[a-f0-9]{8}/);
 assert.match(sw,/\/src\/ui\/park-export-layout\.js/);
});
