import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const file=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
function fixture(options={}){
 const statuses=[],snapshots=[],cached=[];
 const record={id:'surface-user-goksu',owner:'user',parkId:'goksu',parkName:'Göksu Parkı',
  fingerprint:'sha-park',corrections:{'2:3':{from:'water',to:'green',method:'visual-cell'}},
  features:[{type:'water',method:'visual-boundary'}],
  acceptedAt:'2026-10-04T09:00:00.000Z',acceptedResult:{schema:'dendrogeo-surface/2',areas:{green:10},immutable:'published'},draftDirty:true,
  ...options.record};
 const state={record,geometry:{'2:3':[]},epsg:'EPSG:32636',rawView:false,busy:false,saving:false,
  exporting:false,brush:null,draw:null,epoch:3,revision:2,editing:true,...options.state};
 const pending=[
  {key:'4:5',method:'review-cell',type:'other',cell:{classKey:'water'},geom:[[[[1,2],[1,3],[2,3],[1,2]]]]},
  {key:'4:5',method:'review-cell',type:'other',cell:{classKey:'water'},geom:[[[[1,2],[1,3],[2,3],[1,2]]]]},
  {key:'2:3',method:'review-cell',type:'green',cell:{classKey:'water'},geom:[]},
  {key:'9:1',method:'review-cell',type:'other',cell:{classKey:'green'},geom:[]},
  {key:'6:7',method:'visual-boundary',type:'other',cell:{classKey:'water'},geom:[]}
 ];
 const statusEl={textContent:'',dataset:{}},action={disabled:false,isConnected:true};
 const document={readyState:'loading',addEventListener(){},getElementById:id=>({
  dgUxDraftStatus:statusEl,dgUxSaveProjectDraft:action
 })[id]||null};
 let remote=null;
 const context={
  window:{DG_LC_SENS:{state},DG_SURFACE_REVIEW:{
   save:async(snapshot,revision)=>{
    if(options.saveError)throw Error(options.saveError);
    assert.equal(revision,2);
    remote=structuredClone(snapshot);snapshots.push(remote);return 3;
   },
   load:async(id,owner)=>{
    assert.equal(id,'goksu');assert.equal(owner,'user');
    return {revision:3,payload:remote};
   }
  },DG_LC_VALIDATE:{saveCampaign:async v=>{cached.push(v);}}},
  document,console,setTimeout,clearTimeout,Date,structuredClone,
  dgSensParts:()=>pending
 };
 vm.runInNewContext(file('src/ui/gis-project-draft.js'),context,{filename:'gis-project-draft.js'});
 return{api:context.window.DG_GIS_PROJECT_DRAFT,state,record,statusEl,action,snapshots,cached,context,statuses};
}

test('pending-water indicator counts only unresolved outside-water REVIEW cells, and deduplicates for audit',async()=>{
 const f=fixture();
 assert.equal(f.api.pendingParts().length,2);
 assert.equal(await f.api.saveDraft(),true);
 assert.equal(f.snapshots[0].draftWaterUnresolved,1);
 assert.equal(f.record.draftWaterUnresolved,1);
 assert.match(f.statusEl.textContent,/1 belirsiz raster-su hücresi/);
});

test('saving to project stores the EXACT edited draft, not a counterfeit accepted analysis',async()=>{
 const f=fixture();
 const before=structuredClone(f.record.acceptedResult);
 assert.equal(await f.api.saveDraft(),true);
 assert.equal(f.snapshots.length,1);
 assert.equal(f.snapshots[0].draftDirty,true);
 assert.deepEqual(f.snapshots[0].acceptedResult,before);
 assert.deepEqual(f.snapshots[0].corrections,f.record.corrections);
 assert.deepEqual(f.snapshots[0].features,f.record.features);
 assert.equal(f.snapshots[0].fingerprint,'sha-park');
 assert.equal(f.record.serverRevision,3);
 assert.equal(f.state.revision,3);
 assert.equal(f.state.saving,false);
 assert.equal(f.cached.length,1);
 assert.equal(f.cached[0].draftDirty,true);
 assert.match(f.statusEl.textContent,/hesabına TASLAK olarak kaydedildi/);
});

test('missing user and failed server response cannot fabricate project-save success or erase current edits',async()=>{
 const missing=fixture({record:{owner:null}});
 assert.equal(await missing.api.saveDraft(),false);
 assert.equal(missing.snapshots.length,0);
 assert.match(missing.statusEl.textContent,/giriş yapın/);
 const failed=fixture({saveError:'revision conflict'});
 const backup=structuredClone(failed.record);
 assert.equal(await failed.api.saveDraft(),false);
 assert.deepEqual(failed.record,backup);
 assert.equal(failed.state.saving,false);
 assert.match(failed.statusEl.textContent,/revision conflict/);
});

test('outline review shows unknown only without editing source or acceptance, and toggles off',()=>{
 const f=fixture(),polygons=[];
 let removed=0;
 const group={addTo(){return this;},remove(){removed++;}};
 f.context.window.L={
  layerGroup:()=>group,
  polygon:(coords,style)=>{polygons.push({coords,style});return{addTo(){return this;}};}
 };
 f.context.L=f.context.window.L;
 f.context.map={removeLayer:()=>{removed++;}};
 f.context.dgSurfaceUnproject=()=>[[[[32.65,39.99],[32.66,39.99],[32.66,40.0],[32.65,39.99]]]];
 f.api.highlightPending();
 assert.equal(polygons.length,2);
 assert.equal(polygons[0].style.interactive,false);
 assert.deepEqual(f.record.corrections,{'2:3':{from:'water',to:'green',method:'visual-cell'}});
 f.api.highlightPending();
 assert.equal(removed,1);
});

test('draft integration does not override locked acceptance or science and is precached',()=>{
 const src=file('src/ui/gis-project-draft.js');
 const boot=file('partials/boot.html'),sw=file('sw.js');
 const lock=JSON.parse(file('docs/surface-engine-lock.json'));
 assert.equal(Object.keys(lock.locked_files).length,54);
 assert.ok(!lock.locked_files['src/ui/gis-project-draft.js']);
 assert.match(boot,/src\/ui\/gis-project-draft\.js\?v=[a-f0-9]{8}/);
 assert.match(sw,/\x27\/src\/ui\/gis-project-draft\.js\x27/);
 assert.doesNotMatch(src,/dgSensAccept\s*=|dgSensEffective\s*=|acceptedAt\s*=|acceptedResult\s*=|\.to\s*=\s*["']green/);
 assert.match(src,/snapshot\.draftDirty=true/);
 assert.match(src,/DG_SURFACE_REVIEW\.save\(snapshot,s\.revision\)/);
 assert.match(src,/DG_SURFACE_REVIEW\.load\(rec\.parkId,rec\.owner\)/);
});

test('the original locked acceptance gate is never changed by project draft saving',()=>{
 const locked=file('src/ui/lc-sens.js');
 const adapter=file('src/ui/gis-project-draft.js');
 assert.match(locked,/dgSensWaterBoundaryUnresolved\(\)>0\?/);
 assert.match(locked,/sonuç kabul edilmedi/);
 assert.match(adapter,/draftWaterUnresolved=count/);
 assert.match(adapter,/snapshot\.draftDirty=true/);
 assert.doesNotMatch(adapter,/acceptedResult\s*:\s*null|\.acceptedAt\s*=|corrections\[[^\]]+\]\s*=/);
});
