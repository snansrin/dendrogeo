import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const context=vm.createContext({window:{}});
vm.runInContext(readFileSync(new URL('../src/ui/park-image-geometry.js',import.meta.url),'utf8'),context);
const geometry=context.window.DG_PARK_IMAGE_GEOMETRY;

test('park PNG projection retains local scale and latitude/longitude orientation',()=>{
 const p=geometry.project({minLat:39.9,maxLat:40.1,minLon:32.5,maxLon:32.7,width:1000,heightTop:80,scale:2});
 assert.equal(p.lat0,40);assert.equal(p.lon0,32.6);assert.equal(p.MY,110540);assert.equal(p.scale,2);
 assert.equal(p.X(p.lon0),500);assert.equal(p.Y(40.1),80);
 assert.equal(p.Y(39.9),80+(40.1-39.9)*110540*2);
 assert.equal(p.X(32.7),500+(32.7-32.6)*p.MX*2);
});

test('ring tracing maps [latitude, longitude] and closes the canvas path',()=>{
 const events=[],context={beginPath:()=>events.push(['begin']),moveTo:(x,y)=>events.push(['move',x,y]),lineTo:(x,y)=>events.push(['line',x,y]),closePath:()=>events.push(['close'])};
 const projector={X:lon=>lon*10,Y:lat=>lat*20};
 geometry.traceRing({context,projector,ring:[[1,2],[3,4],[5,6]]});
 assert.deepEqual(events,[['begin'],['move',20,20],['line',40,60],['line',60,100],['close']]);
});

test('park exporter keeps its existing projector and ring-path compatibility helpers',()=>{
 const source=readFileSync(new URL('../src/ui/park-export.js',import.meta.url),'utf8');
 assert.match(source,/DG_PARK_IMAGE_GEOMETRY\.project/);
 assert.match(source,/DG_PARK_IMAGE_GEOMETRY\.traceRing/);
 assert.match(source,/dgPxRingPath\(ctx,pr,r\)/);
 assert.match(source,/DG_PARK_EXPORT_LAYOUT\.compute/);
 assert.match(source,/projector:pr/);
});
