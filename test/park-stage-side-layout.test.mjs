import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import{readFileSync}from'node:fs';
test('Left stage panel follows the actual rail without being owned by its renderer and releases observers on close',()=>{
 const ctx=vm.createContext({window:{}});vm.runInContext(readFileSync(new URL('../src/ui/park-stage-side-layout.js',import.meta.url),'utf8'),ctx);
 let railRight=74,observed=[],disconnected=0,invalidated=0;const events={},classes=new Set();
 const workspace={getBoundingClientRect:()=>({left:20,top:100,width:390,height:560}),classList:{add:x=>classes.add(x),remove:x=>classes.delete(x)},append(p){p.parent=this;}},tools={};
 const rail={getBoundingClientRect:()=>({right:railRight,top:188,width:54,height:350})},document={getElementById:id=>id==='surfaceMapWorkspace'?workspace:tools,querySelector:()=>rail};
 class Observer{constructor(fn){this.fn=fn;}observe(node){observed.push(node);}disconnect(){disconnected++;}}
 const windowRef={innerHeight:900,ResizeObserver:Observer,MutationObserver:Observer,addEventListener:(k,f)=>events[k]=f,removeEventListener:k=>delete events[k],requestAnimationFrame:f=>{f();return 1;},cancelAnimationFrame(){}};
 const panel={dataset:{},style:{},remove(){this.parent=null;}},side=ctx.window.DG_PARK_STAGE_SIDE_LAYOUT.create({document,windowRef,getMap:()=>({invalidateSize:()=>invalidated++})});
 side.mount(panel);assert.equal(panel.parent,workspace);assert.equal(panel.style.left,'62px');assert.equal(panel.style.width,'320px');assert.ok(observed.includes(tools));assert.ok(classes.has('dg-stage-side-active'));
 railRight=100;side.position();assert.equal(panel.style.left,'88px');assert.equal(panel.style.width,'294px');panel.dataset.collapsed='true';side.position();assert.equal(panel.style.width,'58px');
 side.clear();assert.equal(panel.parent,null);assert.equal(classes.size,0);assert.equal(disconnected,2);assert.equal(Object.keys(events).length,0);assert.equal(invalidated,2);
});
