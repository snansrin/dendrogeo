import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/ui/park-export-canvas.js',import.meta.url),'utf8');
const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
const context=vm.createContext({window:{}});
vm.runInContext(source,context);
const renderer=context.window.DG_PARK_EXPORT_CANVAS;

test('park PNG renderer clips data layers, then draws the border and standard attribution',()=>{
 const events=[];
 let gridReads=0;
 const session={getCells(){gridReads++;return[{id:'A1',w0:32,w1:32.01,s0:40,s1:40.01}];}};
 const ctx=new Proxy({}, {set(target,key,value){target[key]=value;events.push(['set',key,value]);return true;},
  get(target,key){if(key in target)return target[key];if(key==='measureText')return text=>({width:text.length});
   return (...args)=>events.push([key,...args]);}});
 const name=renderer.draw({context:ctx,
  layout:{W:960,H:700,PAD:70,LEGH:132,scale:1,projector:{X:lon=>lon*100,Y:lat=>lat*100}},
  options:{cover:true,grid:true,wp:true},
  landcover:{patches:[{classKey:'green',rings:[[[40,32],[40.01,32],[40.01,32.01]]]}]},
  outer:[[[40,32],[40.02,32],[40.02,32.02]]],holes:[[[40.005,32.005],[40.006,32.005],[40.006,32.006]]],
  gridSession:()=>session,
  waypoints:()=>[{wp_id:4,lat:40.01,lon:32.01,visited:false}],
  classes:()=>[{key:'green',color:'#16a34a',label:'Yeşil'}],areaM2:()=>10000,osmAttribution:()=> '© OpenStreetMap contributors',
  traceRing:(context,projector,ring)=>{context.beginPath();ring.forEach((point,i)=>i?context.lineTo(projector.X(point[1]),projector.Y(point[0])):context.moveTo(projector.X(point[1]),projector.Y(point[0])));context.closePath();}
 });
 const clip=events.findIndex(e=>e[0]==='clip');
 const restore=events.findIndex(e=>e[0]==='restore');
 const border=events.findIndex((e,i)=>i>restore&&e[0]==='set'&&e[1]==='lineWidth'&&e[2]===2.4);
 assert.ok(clip>0);assert.ok(restore>clip);assert.ok(border>restore);
 assert.equal(events[clip][1],'evenodd');
 assert.equal(gridReads,2,'grid feature check and iteration use the live session');
 assert.ok(events.some(e=>e[0]==='fillText'&&String(e[1]).includes('OpenStreetMap contributors')));
 assert.match(name,/^dendrogeo_park_lulc_grid_wp_\d{4}-\d{2}-\d{2}\.png$/);
});

test('park PNG renderer loads before its download adapter and is precached',()=>{
 assert.ok(index.indexOf('src/ui/park-export-layout.js')<index.indexOf('src/ui/park-export-canvas.js'));
 assert.ok(index.indexOf('src/ui/park-export-canvas.js')<index.indexOf('src/ui/park-export.js'));
 assert.match(index,/src\/ui\/park-export-canvas\.js\?v=[a-f0-9]{8}/);
 assert.match(sw,/\/src\/ui\/park-export-canvas\.js/);
});
