import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import polygon from 'polygon-clipping';
const context=vm.createContext({window:{},console});
for(const file of ['src/domain/parks/stage-geometry.js','src/application/parks/activate-stage-scope.js','src/adapters/parks/stage-store.js'])vm.runInContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),context);
const api=context.window.DG_PARK_STAGE_GEOMETRY,plain=v=>JSON.parse(JSON.stringify(v));
const square=(a,b,size=1)=>[[a,b],[a,b+size],[a+size,b+size],[a+size,b],[a,b]];
const row={id:102,osm_key:'stage/101/'+'a'.repeat(32),name:'Ana park · Bölüm 1',area_m2:100,geom_json:{outer:[square(39,32)],inner:[],stage_scope:{schema:'dendrogeo/park-stage/1',parentId:101}}};
test('Stage clipping keeps real disconnected areas and holes, without changing parent or bridging',()=>{
 const parent={outer:[square(39,32),square(39,34)],inner:[square(39.2,32.2,.2)]},before=JSON.stringify(parent);
 const result=plain(api.clip([[38,31],[38,36],[41,36],[41,31],[38,31]],parent,polygon));
 assert.equal(result.outer.length,2);assert.equal(result.inner.length,1);assert.equal(JSON.stringify(parent),before);
 assert.ok(result.outer.every(r=>Math.max(...r.map(p=>p[1]))<=33||Math.min(...r.map(p=>p[1]))>=34));
});
test('Stage geometry rejects bowtie, collinear, repeated, invalid, excessive and open rings',()=>{
 for(const ring of [[[0,0],[1,1],[0,1],[1,0],[0,0]],[[0,0],[1,0],[2,0],[0,0]],[[0,0],[1,1],[0,0],[1,0],[0,0]],[[0,0],[100,0],[0,1],[0,0]],square(39,32).slice(0,-1),Array.from({length:302},()=>[1,1])])assert.equal(api.validateRing(ring),false);
 assert.throws(()=>api.clip(square(1,1),{outer:[square(39,32)],inner:[]},polygon),/kesişmiyor/);
});
test('Stage candidate is an independent park identity/geometry and rejects wrong parent identity',()=>{
 const candidate=api.candidate(row);assert.equal(candidate.stageRow.id,102);assert.equal(candidate.rings.outer[0][0][0],39);
 candidate.rings.outer[0][0][0]=0;assert.equal(row.geom_json.outer[0][0][0],39);
 assert.throws(()=>api.candidate({...row,osm_key:'way/1'}),/geçersiz/);
 assert.throws(()=>api.candidate({...row,osm_key:'stage/999/'+'a'.repeat(32)}),/geçersiz/);
});
test('Exact stage fence never calls the old margin/circle fallback, including missing geometry and GPS',()=>{
 assert.equal(api.fence({lat:39.1,lon:32.1,acc:5},row,{ACC_MAX_M:60},()=>true).ok,true);
 assert.equal(api.fence({lat:39.1,lon:32.1,acc:5},row,{ACC_MAX_M:60},()=>false).ok,false);
 assert.equal(api.fence({lat:39.1,lon:32.1,acc:61},row,{ACC_MAX_M:60},()=>true).ok,false);
 assert.equal(api.fence(null,row,{ACC_MAX_M:60},()=>true).ok,false);
 assert.equal(api.fence({lat:39.1,lon:32.1,acc:5},{...row,geom_json:null},{ACC_MAX_M:60},()=>true).ok,false);
 assert.equal(api.fence(null,{osm_key:'way/1'},{},()=>true),null);
});
test('New measurements must select a stage-linked project; historical edits and ordinary parks keep old gates',()=>{
 assert.equal(api.measurementGate({park:row,project:{park_id:101}}).reason,'stage-project-required');
 assert.equal(api.measurementGate({park:row,project:{park_id:102}}),null);
 assert.equal(api.measurementGate({park:row,project:{park_id:101},editId:5}),null);
 assert.equal(api.measurementGate({park:{id:101,osm_key:'way/1'},project:{park_id:200}}),null);
});
test('Scope activation validates and saves old draft before drawing; cancellation/stale/failure cannot draw',async()=>{
 const calls=[],ports={isBusy:()=>false,validate:async()=>calls.push('validate'),approveTransition:async()=>{calls.push('save');return true;},isCurrent:()=>true,draw:async()=>calls.push('draw')};
 assert.equal(await context.window.DG_ACTIVATE_STAGE_SCOPE.create(ports)({}),true);assert.deepEqual(calls,['validate','save','draw']);
 calls.length=0;ports.approveTransition=async()=>false;assert.equal(await context.window.DG_ACTIVATE_STAGE_SCOPE.create(ports)({}),false);assert.deepEqual(calls,['validate']);
 ports.approveTransition=async()=>true;ports.isCurrent=()=>false;calls.length=0;assert.equal(await context.window.DG_ACTIVATE_STAGE_SCOPE.create(ports)({}),false);assert.deepEqual(calls,['validate']);
 ports.validate=async()=>{throw Error('network');};await assert.rejects(context.window.DG_ACTIVATE_STAGE_SCOPE.create(ports)({}),/network/);
});
test('Stage adapter resolves only the exact stored id/key and rejects geometry tampering',async()=>{
 const calls=[],client={from:t=>{calls.push(t);return{select(){return this;},eq(k,v){calls.push([k,v]);return this;},single:async()=>({data:row,error:null})};}};
 const store=context.window.DG_PARK_STAGE_STORE.create(()=>client),candidate=api.candidate(row);
 assert.equal((await store.resolve(candidate)).id,102);assert.deepEqual(calls,['parks',['id',102],['osm_key',row.osm_key]]);
 candidate.rings.outer[0][0][0]=0;await assert.rejects(store.resolve(candidate),/eşleşmiyor/);
});
test('Stage view escapes user content and exposes labelled controls with explicit boundary acceptance',()=>{
 vm.runInContext(readFileSync(new URL('../src/ui/park-stage-view.js',import.meta.url),'utf8'),context);
 const render=context.window.DG_PARK_STAGE_VIEW.render,escape=s=>String(s).replaceAll('<','&lt;').replaceAll('>','&gt;');
 const html=render({escape,baseName:'<img src=x>',rows:[{...row,geom_json:{...row.geom_json,stage_scope:{label:'<script>bad</script>'}}}],ready:true,editing:true});
 assert.doesNotMatch(html,/<img|<script>/);assert.match(html,/for="dgStageSelect"/);assert.match(html,/for="dgStageName"/);assert.match(html,/Sınırı kabul et ve kaydet/);assert.match(html,/role="status"/);
});
test('Stage drawing restores detection/guard and removes temporary parent boundary on Escape',()=>{
 vm.runInContext(readFileSync(new URL('../src/ui/park-stage-drawing.js',import.meta.url),'utf8'),context);
 const listeners={},layers=new Set();let mode=true,guard=false,zoom=true;
 const map={on:(event,fn)=>{listeners[event]=fn;},off:event=>delete listeners[event],removeLayer:l=>layers.delete(l),fitBounds(){},doubleClickZoom:{enabled:()=>zoom,disable:()=>{zoom=false;},enable:()=>{zoom=true;}}};
 const document={addEventListener:(event,fn)=>{listeners[event]=fn;},removeEventListener:event=>delete listeners[event]};
 const layer=()=>({addTo(){layers.add(this);return this;},getBounds(){return {};}});
 const drawing=context.window.DG_PARK_STAGE_DRAWING_UI.create({document,leaflet:{polyline:layer,polygon:layer},getMap:()=>map,getMode:()=>mode,setMode:v=>{mode=v;},getGuard:()=>guard,setGuard:v=>{guard=v;},parentGeometry:()=>row.geom_json,status(){}});
 drawing.start();assert.equal(mode,false);assert.equal(guard,true);assert.equal(zoom,false);assert.equal(layers.size,1);
 listeners.click({latlng:{lat:39,lng:32}});listeners.click({latlng:{lat:40,lng:32}});assert.equal(drawing.ring().length,3);
 drawing.undo();assert.equal(drawing.ring().length,2);listeners.keydown({key:'Escape'});
 assert.equal(mode,true);assert.equal(guard,false);assert.equal(zoom,true);assert.equal(layers.size,0);assert.deepEqual(Object.keys(listeners),[]);
});
test('Stage bootstrap refuses a failed draft save and reuses only an exactly validated stage identity',async()=>{
 let ports,resolves=0,saveResult=false;
 const root={DG_PARK_STAGE_STORE:{create:()=>({resolve:async c=>{resolves++;return c.stageRow;}})},DG_PARK_STAGE_WORKSPACE_UI:{create:p=>{ports=p;return {};}},DG_LC_SENS:{state:{record:{}}}};
 const ctx=vm.createContext({window:root,document:{},esc:String,L:{},sb:{},dgSensSave:async()=>saveResult});
 vm.runInContext(readFileSync(new URL('../src/bootstrap/park-stage-workspace.js',import.meta.url),'utf8'),ctx);
 await assert.rejects(ports.approveTransition(),/kaydedilemedi/);saveResult=true;assert.equal(await ports.approveTransition(),true);
 const candidate=api.candidate(row);await ports.validate(candidate);assert.equal((await root.DG_RESOLVE_STAGE_PARK(candidate)).id,102);assert.equal(resolves,1);
});
test('Stage workspace binds UI workflow with parent-scoped reads and current-epoch guards',()=>{
 // The real three-width browser workflow executes this same controller.
 const source=readFileSync(new URL('../src/ui/park-stage-workspace.js',import.meta.url),'utf8');
 assert.match(source,/ports\.store\.list\(base\.row\.id\)/);assert.match(source,/token!==epoch/);
 assert.match(source,/parentId===base\.row\.id/);assert.match(source,/DG_ACTIVATE_STAGE_SCOPE\.create/);
});
