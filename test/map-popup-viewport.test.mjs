import {test} from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
function target(){const events=new Map();return{events,addEventListener:(key,fn)=>events.set(key,fn),removeEventListener:(key,fn)=>{if(events.get(key)===fn)events.delete(key);}};}
function setup(){
 const root=target(),document=target(),element=target(),markerEvents={},frames=new Map();let seq=0,updates=0;
 const box={left:100,right:500,top:-120,bottom:480},image={src:'/photo.jpg',naturalWidth:0,naturalHeight:0},container={getBoundingClientRect:()=>box};
 document.documentElement={};root.ResizeObserver=class{constructor(callback){this.callback=callback;this.targets=[];root.observer=this;}observe(target){this.targets.push(target);}disconnect(){this.disconnected=true;}};
 document.querySelectorAll=()=>[{getBoundingClientRect:()=>({top:0,bottom:56,width:360})},{getBoundingClientRect:()=>({top:56,bottom:110,width:360})}];
 element.closest=()=>container;element.querySelectorAll=()=>[image];
 Object.assign(root,{document,innerWidth:360,innerHeight:600,getComputedStyle:()=>({position:'sticky'}),requestAnimationFrame:fn=>{frames.set(++seq,fn);return seq;},cancelAnimationFrame:id=>frames.delete(id)});
 const popup={options:{},getElement:()=>element,update:()=>updates++},marker={on:(name,fn)=>markerEvents[name]=fn};
 vm.runInNewContext(readFileSync('src/ui/map-popup-viewport.js','utf8'),{window:root});root.DG_MAP_POPUP_VIEWPORT.attach(marker);
 const flush=()=>{const callbacks=[...frames.values()];frames.clear();callbacks.forEach(fn=>fn());};return{root,document,element,image,box,frames,popup,markerEvents,flush,updates:()=>updates};
}
test('photo popup uses visible map intersection and reserves sticky bars without changing map geometry',()=>{
 const a=setup();a.markerEvents.popupopen({popup:a.popup});a.flush();assert.equal(a.popup.options.maxWidth,212);assert.equal(a.popup.options.maxHeight,298);assert.deepEqual(Array.from(a.popup.options.autoPanPaddingTopLeft),[12,242]);assert.deepEqual(Array.from(a.popup.options.autoPanPaddingBottomRight),[152,12]);assert.equal(a.updates(),1);
});
test('cached photo load cannot loop popup updates; inner scrolling is ignored and close/remove release listeners',()=>{
 const a=setup();a.markerEvents.popupopen({popup:a.popup});a.flush();a.image.naturalWidth=900;a.image.naturalHeight=2400;a.element.events.get('load')();a.flush();assert.equal(a.updates(),2);
 a.element.events.get('load')();assert.equal(a.frames.size,0,'a cached replacement image must not trigger another content rebuild');
 a.document.events.get('scroll')({target:{contains:()=>false}});assert.equal(a.frames.size,0);
 a.document.events.get('scroll')({target:a.document});a.root.events.get('resize')();assert.equal(a.frames.size,1,'scroll and resize share one pending frame');
 a.markerEvents.popupclose();assert.equal(a.frames.size,0);assert.equal(a.root.events.size,0);assert.equal(a.document.events.size,0);assert.equal(a.element.events.size,0);
 a.markerEvents.popupopen({popup:a.popup});a.flush();assert.equal(a.updates(),3);a.markerEvents.remove();assert.equal(a.root.events.size,0);assert.equal(a.document.events.size,0);
});

test('late responsive layout recomputes popup height and disconnects map/document observers',()=>{
 const a=setup();a.markerEvents.popupopen({popup:a.popup});a.flush();assert.equal(a.root.observer.targets.length,2);
 a.box.top=300;a.box.bottom=552;a.root.innerHeight=420;a.root.observer.callback();a.flush();assert.equal(a.popup.options.maxHeight,48);assert.deepEqual(Array.from(a.popup.options.autoPanPaddingBottomRight),[152,144]);
 const observer=a.root.observer;a.markerEvents.popupclose();assert.equal(observer.disconnected,true);
});
