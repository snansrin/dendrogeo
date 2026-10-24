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
 click([39.1,32]);const first=[...layers].find(l=>l.dragging);first.callbacks.dragstart();first.callbacks.dragend();assert.match(messages.at(-1),/Bitiş noktasını seçin/);
 click([39.5,32]);const markers=[...layers].filter(l=>l.dragging);assert.equal(markers.length,2);
 tool.setLocked(true);assert.ok(markers.every(m=>!m.dragging.enabled));tool.setLocked(false);assert.ok(markers.every(m=>m.dragging.enabled));
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
