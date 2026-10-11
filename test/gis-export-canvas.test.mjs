import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const context=vm.createContext({window:{}});
vm.runInContext(readFileSync(new URL('../src/ui/gis-export-canvas.js',import.meta.url),'utf8'),context);
const canvas=context.window.DG_GIS_EXPORT_CANVAS;
function mockContext(){
 const events=[];
 return {events,beginPath:()=>events.push(['begin']),moveTo:(x,y)=>events.push(['move',x,y]),lineTo:(x,y)=>events.push(['line',x,y]),closePath:()=>events.push(['close']),fill:rule=>events.push(['fill',rule]),globalAlpha:1,fillStyle:''};
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
