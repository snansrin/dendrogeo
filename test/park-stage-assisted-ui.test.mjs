import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import{readFileSync}from'node:fs';
function load(path,root={}){const ctx=vm.createContext({window:root});vm.runInContext(readFileSync(new URL('../'+path,import.meta.url),'utf8'),ctx);return root;}
test('Assisted selection cancels stale previews, restores map ownership and locks draggable cut points during save',async()=>{
 const root=load('src/ui/park-stage-assisted-selection.js'),listeners={},layers=new Set(),messages=[];let mode=true,guard=false,zoom=true,release,previews=0;
 const container={addEventListener:(type,fn)=>{listeners[type]=fn;},removeEventListener:type=>delete listeners[type]};
 const document={addEventListener:(type,fn)=>{listeners[type]=fn;},removeEventListener:type=>delete listeners[type]};
 const map={getContainer:()=>container,mouseEventToLatLng:e=>({lat:e.point[0],lng:e.point[1]}),fitBounds(){},removeLayer:layer=>layers.delete(layer),doubleClickZoom:{enabled:()=>zoom,disable:()=>{zoom=false;},enable:()=>{zoom=true;}}};
 const layer=()=>({addTo(){layers.add(this);return this;},getBounds(){return {};}});
 const marker=(point)=>({...layer(),point,callbacks:{},dragging:{enabled:true,disable(){this.enabled=false;},enable(){this.enabled=true;}},on(type,fn){this.callbacks[type]=fn;},getLatLng(){return{lat:this.point[0],lng:this.point[1]};}});
 const tool=root.DG_PARK_STAGE_ASSISTED_UI.create({document,leaflet:{polygon:layer,polyline:layer,marker,layerGroup:layer},getMap:()=>map,getMode:()=>mode,setMode:v=>{mode=v;},getGuard:()=>guard,setGuard:v=>{guard=v;},parentGeometry:()=>({outer:[[[39,32],[40,32],[40,33],[39,32]]],inner:[]}),status:message=>messages.push(message),onPreview:()=>{previews++;},onInvalid:()=>messages.push('updating'),onCancel(){},between:()=>new Promise(resolve=>{release=resolve;})});
 tool.start();assert.equal(mode,false);assert.equal(guard,true);assert.equal(zoom,false);
 const click=point=>listeners.click({point,target:{closest:()=>null},preventDefault(){},stopImmediatePropagation(){}});
 click([39.1,32]);const first=[...layers].find(l=>l.dragging);first.callbacks.dragstart();first.callbacks.dragend();assert.match(messages.at(-1),/Başlangıç sınırı/);
 click([39.1,32.2]);assert.match(messages.at(-1),/Bitiş sınırı/);click([39.5,32]);click([39.6,32.2]);const markers=[...layers].filter(l=>l.dragging);assert.equal(markers.length,4);
 tool.setLocked(true);assert.ok(markers.every(m=>!m.dragging.enabled));listeners.keydown({key:'Escape'});assert.equal(tool.isActive(),true,'Escape cannot cancel an in-flight explicit save');assert.equal([...layers].filter(l=>l.dragging).length,4);tool.setLocked(false);assert.ok(markers.every(m=>m.dragging.enabled));
 tool.clear();release({geometry:{outer:[],inner:[]},lines:[]});await Promise.resolve();await Promise.resolve();
 assert.equal(previews,0);assert.equal(layers.size,0);assert.equal(mode,true);assert.equal(guard,false);assert.equal(zoom,true);assert.deepEqual(Object.keys(listeners),[]);
});
class Node{
 constructor(tag){this.tag=tag;this.children=[];this.dataset={};this.style={};this.events={};this.open=false;this.textContent='';}
 append(...nodes){for(const node of nodes){node.remove();this.children.push(node);node.parent=this;}}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);this.parent=null;}
 before(node){const parent=this.parent;if(parent){node.remove();parent.children.splice(parent.children.indexOf(this),0,node);node.parent=parent;}}
 setAttribute(k,v){this[k]=v;}addEventListener(type,fn){this.events[type]=fn;}scrollIntoView(){}
 querySelectorAll(selector){if(selector.includes('details[open]'))return this.children.filter(n=>n.tag==='details'&&n.open);return this.children.flatMap(n=>[...(n.tag==='button'?[n]:[]),...n.querySelectorAll(selector)]);}
 querySelector(selector){return this.children.find(n=>selector.includes('dg-editor-menu-body')?n.className==='dg-editor-menu-body':Object.hasOwn(n.dataset,'stageHint'))||this.children.map(n=>n.querySelector(selector)).find(Boolean);}
}

test('Detailed cap drawing retains the other line, supports insertion and undo, and ignores removed handles',async()=>{
 const root=load('src/ui/park-stage-assisted-selection.js'),events={},layers=new Set();let preview=null;
 const node={addEventListener:(k,fn)=>events[k]=fn,removeEventListener:k=>delete events[k]},map={getContainer:()=>node,mouseEventToLatLng:e=>({lat:e.p[0],lng:e.p[1]}),removeLayer:l=>layers.delete(l),fitBounds(){},doubleClickZoom:{enabled:()=>false,disable(){}}};
 const layer=()=>({callbacks:{},addTo(){layers.add(this);return this;},on(k,fn){this.callbacks[k]=fn;return this;},getBounds:()=>({})});
 const marker=p=>({...layer(),point:p,dragging:{disable(){},enable(){}},getLatLng(){return{lat:this.point[0],lng:this.point[1]};}});
 const tool=root.DG_PARK_STAGE_ASSISTED_UI.create({document:node,leaflet:{marker,polygon:layer,polyline:(points,options)=>({...layer(),points,options}),layerGroup:children=>({...layer(),children})},getMap:()=>map,getMode:()=>false,setMode(){},getGuard:()=>false,setGuard(){},parentGeometry:()=>({outer:[[[39,32],[39,33],[40,33],[39,32]]]}),status(){},onInvalid(){},onProgress(){},onPreview:r=>{preview=r;},onCancel(){},between:async cuts=>({geometry:{outer:[],inner:[]},lines:[],cuts})});
 const click=p=>events.click({p,target:{closest:()=>null},preventDefault(){},stopImmediatePropagation(){}});
 const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
 tool.start(null,true);for(const p of [[39,32],[39.01,32.1],[39,32.2]])click(p);tool.selectBoundary(1);for(const p of [[39.1,32],[39.11,32.1],[39.1,32.2]])click(p);await flush();
 assert.equal(preview.cuts[0].length,3);assert.equal(preview.cuts[1].length,3);
 const old=[...layers].find(l=>l.dragging),segment=[...layers].find(l=>l.children?.some(n=>n.options?.className==='dg-stage-cut-segment')).children[0];
 segment.callbacks.click({latlng:{lat:39.005,lng:32.05}});await flush();assert.equal(preview.cuts[0].length,4);assert.equal(preview.cuts[1].length,3);
 old.point=[0,0];old.callbacks.dragend();await flush();assert.equal(preview.cuts[0][0][0],39,'a removed reference cannot change the current cap');
 tool.selectBoundary(0);tool.undo();await flush();assert.equal(preview.cuts[0].length,3);assert.equal(preview.cuts[1].length,3);
 tool.start(preview.cuts,true);click([39.01,32.3]);await flush();assert.equal(preview.cuts[0].length,4,'reopening a saved cap does not lock further point placement');assert.equal(preview.cuts[1].length,3);
 tool.clear();segment.callbacks.click({latlng:{lat:0,lng:0}});assert.equal(layers.size,0);
});
test('Upper Tools menu retains its real host, closes sibling menus and puts selection hints outside the map',()=>{
 const bar=new Node('nav'),legacy=new Node('details');legacy.dataset.menuOrder='20';legacy.open=true;bar.append(legacy);
 const page=new Node('main'),workspace=new Node('div'),map=new Node('div');page.append(workspace);workspace.append(map);
 const document={createElement:tag=>new Node(tag),getElementById:id=>id==='surfaceMenuBar'?bar:id==='surfaceMapWorkspace'?workspace:null};
 const root=load('src/ui/park-stage-menu.js'),menu=root.DG_PARK_STAGE_MENU_UI.create({document,windowRef:{},getMap:()=>({getContainer:()=>map})}),host=new Node('section');
 menu.mount(host);assert.equal(bar.children.length,2);const details=bar.children[1];assert.equal(details.dataset.menuOwner,'stage');assert.equal(details.children[1].children[0],host);
 menu.open();details.events.toggle();assert.equal(legacy.open,false);assert.equal(details.open,true);
 menu.showHint('Choose two points',()=>{},()=>{});const hint=page.children[0];assert.notEqual(hint,map);assert.equal(hint.parent,page);assert.equal(map.children.length,0);
 menu.setBusy(true);assert.ok(hint.querySelectorAll('button').every(b=>b.disabled));menu.status('Ready');assert.equal(hint.querySelector('[data-stage-hint]').textContent,'Ready');
 menu.clear();assert.deepEqual(bar.children,[legacy]);assert.deepEqual(page.children,[workspace]);
});
