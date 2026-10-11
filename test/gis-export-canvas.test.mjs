import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const context=vm.createContext({window:{}});
vm.runInContext(readFileSync(new URL('../src/ui/gis-export-canvas.js',import.meta.url),'utf8'),context);
const canvas=context.window.DG_GIS_EXPORT_CANVAS;
function mockContext(){
 const events=[];
 return {events,beginPath:()=>events.push(['begin']),moveTo:(x,y)=>events.push(['move',x,y]),lineTo:(x,y)=>events.push(['line',x,y]),closePath:()=>events.push(['close']),fill:rule=>events.push(['fill',rule]),stroke:()=>events.push(['stroke']),strokeRect:(...args)=>events.push(['rect',...args]),arc:(...args)=>events.push(['arc',...args]),fillText:(...args)=>events.push(['text',...args]),globalAlpha:1,fillStyle:''};
}

test('Leaflet polygons draw every outer and inner ring into one even-odd fill',()=>{
 const ctx=mockContext(),pr={x:lng=>lng*10,y:lat=>lat*20};
 const outer=[{lat:1,lng:2},{lat:3,lng:4},{lat:5,lng:6}];
 const hole=[{lat:7,lng:8},{lat:9,lng:10},{lat:11,lng:12}];
 const layer={getLatLngs:()=>[[outer,hole]],options:{fillColor:'#123456'}};
 assert.equal(canvas.drawLeaflet(ctx,pr,layer,1.4),true);
 assert.equal(ctx.events.filter(x=>x[0]==='begin').length,1);
 assert.equal(ctx.events.filter(x=>x[0]==='close').length,2);
 assert.deepEqual(ctx.events.find(x=>x[0]==='move'),['move',20,20]);
 assert.ok(ctx.events.some(x=>x[0]==='move'&&x[1]===80&&x[2]===140));
 assert.ok(ctx.events.some(x=>x[0]==='fill'&&x[1]==='evenodd'));
 assert.equal(ctx.fillStyle,'#123456');assert.equal(ctx.globalAlpha,1);
});

test('invalid Leaflet layer is skipped without touching the Canvas',()=>{
 const ctx=mockContext();
 assert.equal(canvas.drawLeaflet(ctx,{x:x=>x,y:y=>y},{},.6),false);
 assert.deepEqual(ctx.events,[]);
});

test('raw surface patches preserve [latitude, longitude], class fallback, and paint count',()=>{
 const ctx=mockContext(),pr={x:lng=>lng+100,y:lat=>lat+200};
 const patches=[
  {classKey:'water',rings:[[[1,2],[3,4],[5,6]]]},
  {group:'paving',rings:[[[7,8],[9,10],[11,12]],[[13,14],[15,16],[17,18]]]},
  {group:'empty',rings:[]}
 ];
 assert.equal(canvas.drawRawPatches(ctx,pr,patches,{water:{color:'#00f'}}),2);
 assert.ok(ctx.events.some(x=>x[0]==='move'&&x[1]===102&&x[2]===201));
 assert.deepEqual(ctx.events.filter(x=>x[0]==='fill'),[['fill','evenodd'],['fill','evenodd']]);
 assert.equal(ctx.globalAlpha,1);
});

test('grid cells preserve projected bounds, style, and skip invalid coordinates',()=>{
 const ctx=mockContext(),pr={x:lon=>lon*10,y:lat=>lat*20};
 canvas.drawGrid(ctx,pr,[{w0:2,w1:4,s0:1,s1:3},{w0:0,w1:1,s0:2,s1:Infinity}]);
 assert.deepEqual(ctx.events,[['rect',20,60,20,-40]]);
 assert.equal(ctx.lineWidth,1);assert.equal(ctx.strokeStyle,'#166534');
});

test('waypoints preserve visited colors, projected locations, and skip invalid coordinates',()=>{
 const ctx=mockContext(),pr={x:lon=>lon*10,y:lat=>lat*20};
 canvas.drawWaypoints(ctx,pr,[{lat:2,lon:3,visited:true},{lat:4,lon:5,visited:false},{lat:NaN,lon:6},{lat:7,lon:Infinity}]);
 assert.deepEqual(ctx.events.filter(x=>x[0]==='arc'),[
  ['arc',30,40,5,0,Math.PI*2],['arc',50,80,5,0,Math.PI*2]
 ]);
 assert.equal(ctx.events.filter(x=>x[0]==='fill').length,2);
 assert.equal(ctx.events.filter(x=>x[0]==='stroke').length,2);
 assert.equal(ctx.fillStyle,'#e11d48');assert.equal(ctx.strokeStyle,'#fff');assert.equal(ctx.lineWidth,1.7);
});

test('verified grids draw GeoJSON rings and retain finite-bound rectangle fallback',()=>{
 const ctx=mockContext(),pr={x:lon=>lon*10,y:lat=>lat*20};
 canvas.drawVerifiedGrid(ctx,pr,[
  {geometry:{coordinates:[[[[1,2],[3,4],[5,6]]]]}},
  {w0:2,w1:4,s0:1,s1:3},
  {w0:NaN,w1:4,s0:1,s1:3}
 ],'#14532d');
 assert.deepEqual(ctx.events,[['begin'],['move',10,40],['line',30,80],['line',50,120],['close'],['stroke'],['rect',20,60,20,-40]]);
 assert.equal(ctx.strokeStyle,'#14532d');assert.equal(ctx.lineWidth,1);
});

test('verified waypoints retain numbered labels, status colors, and white outlines',()=>{
 const ctx=mockContext(),pr={x:lon=>lon*10,y:lat=>lat*20};
 canvas.drawVerifiedWaypoints(ctx,pr,[{lat:2,lon:3,visited:true,wp_id:11},{lat:4,lon:5,id:12}], '#182420');
 assert.deepEqual(ctx.events.filter(x=>x[0]==='arc'),[['arc',30,40,7,0,Math.PI*2],['arc',50,80,7,0,Math.PI*2]]);
 assert.deepEqual(ctx.events.filter(x=>x[0]==='text'),[['text','11',40,44],['text','12',60,84]]);
 assert.equal(ctx.events.filter(x=>x[0]==='stroke').length,2);
 assert.equal(ctx.fillStyle,'#182420');assert.equal(ctx.font,'bold 14px Arial');
});
