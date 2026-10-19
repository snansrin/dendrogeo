import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
class Element{
 constructor(){this.dataset={};this.listeners={};this.attributes={};this.classes=new Set();this.classList={toggle:(key,on)=>on?this.classes.add(key):this.classes.delete(key)};}
 addEventListener(name,fn){this.listeners[name]=fn;}
 setAttribute(key,value){this.attributes[key]=value;}
 fire(name,event={}){this.listeners[name]?.(event);}
 focus(){this.focused=true;}
}
function fixture(reduced=false){
 const host=new Element(),track=new Element(),panels=Array.from({length:6},(_,i)=>new Element()),buttons=panels.map(()=>new Element()),status={},prev=new Element(),next=new Element(),frames=[];
 track.clientWidth=1000;track.scrollLeft=0;track.getBoundingClientRect=()=>({left:0});track.scrollTo=options=>{track.lastScroll=options;track.scrollLeft=options.left;};panels.forEach((panel,i)=>{panel.offsetLeft=i*1000;panel.getBoundingClientRect=()=>({left:panel.offsetLeft-track.scrollLeft});});
 host.querySelector=selector=>({'[data-showcase-track]':track,'[data-showcase-status]':status,'[data-showcase-prev]':prev,'[data-showcase-next]':next}[selector]);host.querySelectorAll=selector=>selector==='[data-showcase-panel]'?panels:buttons;
 const window={requestAnimationFrame:fn=>{frames.push(fn);return frames.length;},matchMedia:()=>({matches:reduced}),addEventListener:()=>{}};
 vm.runInNewContext(readFileSync(new URL('../src/ui/landing-showcase.js',import.meta.url),'utf8'),{window});const controller=window.DG_LANDING_SHOWCASE.mount(host);
 return{host,track,panels,buttons,status,prev,next,frames,controller};
}
test('showcase moves copy and media together, wraps, and excludes offscreen panels from keyboard access',()=>{
 const f=fixture();f.next.fire('click');assert.equal(f.controller.index(),1);assert.equal(f.track.lastScroll.left,1000);assert.equal(f.status.textContent,'02 / 06');assert.deepEqual(f.panels.map(p=>p.inert),[true,false,true,true,true,true]);assert.equal(f.buttons[1].attributes['aria-pressed'],'true');f.controller.go(0);f.prev.fire('click');assert.equal(f.controller.index(),5);
});
test('keyboard navigation, touch-scroll state and reduced motion stay synchronized',()=>{
 const f=fixture(true);let prevented=false;f.host.fire('keydown',{key:'End',preventDefault(){prevented=true;}});assert.equal(prevented,true);assert.equal(f.controller.index(),5);assert.equal(f.buttons[5].focused,true);assert.equal(f.track.lastScroll.behavior,'auto');f.track.fire('pointerdown');f.track.scrollLeft=2000;f.track.fire('scroll');f.frames.shift()();assert.equal(f.controller.index(),2);assert.equal(f.status.textContent,'03 / 06');
});
test('rapid navigation ignores intermediate smooth-scroll positions and preserves browser shortcuts',()=>{
 const f=fixture();f.next.fire('click');f.next.fire('click');f.track.scrollLeft=1000;f.track.fire('scroll');f.frames.shift()();assert.equal(f.controller.index(),2);let prevented=false;f.host.fire('keydown',{key:'Home',ctrlKey:true,preventDefault(){prevented=true;}});assert.equal(prevented,false);assert.equal(f.controller.index(),2);
});
test('manual touch scrolling settles to the measured nearest slide even when panel offsets differ from viewport steps',()=>{
 const f=fixture();f.panels.forEach((panel,i)=>{panel.offsetLeft=i*1000+(i?18:0);panel.getBoundingClientRect=()=>({left:panel.offsetLeft-f.track.scrollLeft});});
 f.track.fire('touchstart');f.track.scrollLeft=2050;f.track.fire('scroll');f.frames.shift()();f.track.fire('scrollend');
 assert.equal(f.controller.index(),2);assert.equal(f.track.lastScroll.left,2018);assert.equal(f.status.textContent,'03 / 06');
});
test('public park exhibit contains actual accepted geometries and no account or user payload',()=>{
 const data=JSON.parse(readFileSync(new URL('../assets/landing/goksu-example.json',import.meta.url),'utf8'));assert.equal(data.park.osmKey,'way/423602737');assert.equal(data.source.status,'user-accepted');assert.equal(data.source.revision,32);assert.equal(data.source.publicRpc,'dg_accepted_park_surface');assert.ok(data.features.every(f=>f.geometry.type==='MultiPolygon'));assert.ok(data.areas.building>0&&data.areas.water>0);assert.equal(Object.hasOwn(data.areas,'pool'),false);
 const visit=value=>{if(!value||typeof value!=='object')return;for(const [key,child]of Object.entries(value)){assert.ok(!['owner','email','user_id','access_token','refresh_token','requested_by','created_by'].includes(key));visit(child);}};visit(data);
});
test('NDVI exhibit keeps actual observations, sample-grid provenance and production tercile thresholds',()=>{
 const data=JSON.parse(readFileSync(new URL('../assets/landing/goksu-example.json',import.meta.url),'utf8')),ndvi=data.ndvi;
 assert.equal(ndvi.source,'Microsoft Planetary Computer / sentinel-2-l2a');assert.equal(ndvi.grid.cellSizeM,10);assert.equal(ndvi.grid.epsg,data.source.epsg);
 const values=Object.values(ndvi.observations).filter(row=>Number.isFinite(row.ndviMedianYear)&&row.ndviObs>=3).map(row=>row.ndviMedianYear).sort((a,b)=>a-b);
 assert.equal(values.length,ndvi.count);assert.equal(ndvi.count,2129);assert.equal(ndvi.stats.nInsufficient,0);assert.equal(ndvi.scenes.length,6);
 for(const [index,q]of [1/3,2/3].entries()){const at=(values.length-1)*q,lo=Math.floor(at),hi=Math.ceil(at);assert.equal(ndvi.cutoffs[index],values[lo]+(values[hi]-values[lo])*(at-lo));}
 assert.deepEqual(ndvi.features.map(f=>f.properties.class),['sparse','moderate','dense']);assert.ok(ndvi.features.every(f=>f.geometry.type==='MultiPolygon'&&f.geometry.coordinates.length));
 assert.ok(!JSON.stringify(ndvi).includes('sig='));assert.ok(ndvi.acquiredAt>ndvi.surfaceContext.acceptedAt);
});
