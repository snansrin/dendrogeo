import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
function fixture({throwService=false,movePark=false}={}){
 const accepted={schema:'dendrogeo-surface/2',areas:{water:120000,hard:65000,green:320000},timestamp:'frozen'};
 const manual={from:'water',to:'hard',method:'visual-cell',source:'user'};
 const rec={parkId:'goksu',fingerprint:'sha-baseline',scannedAt:'2026-10-08',
  period:'ytd',corrections:{'90:90':manual},
  features:[{type:'water',method:'visual-boundary'}],
  profile:{cells:{'0:0':{obs:4,ndvi:.68}}},
  acceptedResult:structuredClone(accepted),acceptedAreas:structuredClone(accepted.areas),
  acceptedAt:'2026-10-08',draftDirty:true};
 const state={record:rec,epoch:3,partitionVersion:4,visualVersion:8,geometry:{ready:true},
   editing:true,rawView:false,busy:false,saving:false,exporting:false,brush:null,draw:null};
 const cells=Array.from({length:69},(_,i)=>({row:i+1,col:0,
  classKey:'water',rasterClassKey:'water',areaM2:100,center:{lat:39.9+i*.0001,lon:32.6}}));
 const events=[],status={textContent:''};
 const sampleProfile={cells:{},evidenceVersion:'distinct-dates-v3'};
 for(let i=0;i<69;i++){
  const k=(i+1)+':0';
  sampleProfile.cells[k]={obs:i<20?5:i<40?4:i<55?3:0,
   ndvi:i<20?.62:i<40?.08:i<55?.11:null,
   mndwi:0,ndbi:0};
 }
 const scope={
  window:{DG_LC_SENS:{state},DG_LC_S2:{
   profile:async(subset,outer,opts)=>{
    events.push(['profile',subset.length,opts.mode]);
    if(movePark)state.epoch++;
    if(throwService)throw Error('Sentinel endpoint timeout');
    return sampleProfile;
   }
  },DG_LC_VALIDATE:{
   spectralLandPredict:e=>{
    if(!e||e.obs<3)return'nodata';
    return e.ndvi>=.5?'green':e.ndvi<.1?'hard':e.ndvi<.12?'ambiguous':'bare';
   }
  }},
  PARK_POLY:[[[39.9,32.5],[39.9,32.7],[40,32.7]]],
  DG_LC_LAST:{report:{year:2021}},
  document:{readyState:'loading',addEventListener(){},
   getElementById:id=>id==='dgUxDraftStatus'?status:null},
  console,Date,setTimeout,clearTimeout,
  dgSensParts:()=>cells.map(c=>{
   const key=c.row+':'+c.col;
   const pred=rec.profile?.cells?.[key];
   const type=pred?scope.window.DG_LC_VALIDATE.spectralLandPredict(pred):'other';
   return {key,cell:c,type: type==='nodata'||type==='ambiguous'?'other':type,
    method:'review-cell',areaM2:100};
  }),
  dgSensDirty(){events.push('dirty');rec.draftDirty=true;state.editing=true;state.visualVersion++;},
  dgSensRefreshLayer(){events.push('refresh');return Promise.resolve();},
  dgSensUpdateSummary(){events.push('summary');},
  dgSensSave(){events.push('save');return Promise.resolve(true);},
  dgSensWaterBoundaryUnresolved:()=>scope.dgSensParts().filter(x=>x.type==='other').length
 };
 vm.runInNewContext(read('src/ui/gis-water-neighbour.js'),scope);
 return {api:scope.window.DG_GIS_WATER_NEIGHBOUR,rec,state,events,status,accepted,manual,cells};
}
test('second-pass Sentinel spectral samples resolve supported green and hard while leaving ambiguous cells honest',async()=>{
 const f=fixture();
 const before=structuredClone(f.rec.acceptedResult);
 const result=await f.api.recheckMissing();
 assert.equal(result.checked,69);
 assert.equal(result.resolved,40);
 assert.equal(result.remaining,29);
 assert.equal(result.byClass.green,20);
 assert.equal(result.byClass.hard,20);
 assert.deepEqual(f.rec.acceptedResult,before);
 assert.deepEqual(f.rec.acceptedAreas,before.areas);
 assert.deepEqual(f.rec.corrections,{'90:90':f.manual},'no false visual-cell or manual judgments');
 assert.equal(f.rec.profile.cells['0:0'].ndvi,.68,'pre-existing spectral measurements retained');
 assert.equal(Object.keys(f.rec.profile.cells).length,41);
 assert.equal(f.rec.profile.supplementalSpectral.cellsResolved,40);
 assert.equal(f.rec.profile.supplementalSpectral.period,'latest');
 assert.deepEqual(f.events.slice(1),['dirty','refresh','summary','save']);
 assert.equal(f.events[0][0],'profile');
 assert.ok(f.events.includes('dirty'));
 assert.match(f.status.textContent,/kalan: 29/);
 assert.match(f.status.textContent,/yeterli gözlem yok 14, kararsız spektrum 15/);
});
test('no data / ambiguous periods do not make up green land cover and never modify saved results',async()=>{
 const f=fixture();
 f.rec.period='latest';
 f.state.rawView=true;
 assert.equal((await f.api.recheckMissing()).reason,'busy');
 assert.equal(f.events.length,0);
 f.state.rawView=false;
 f.rec.corrections['1:0']={from:'water',to:'hard',method:'visual-cell',source:'user'};
 const result=await f.api.recheckMissing();
 assert.equal(result.checked,68);
 assert.equal(f.rec.corrections['1:0'].source,'user');
 assert.equal(f.events[0][2],'ytd');
});
test('stale project/spectral session and service failure never assign class or corrupt accepted map',async()=>{
 const moved=fixture({movePark:true});
 const backup=structuredClone(moved.rec.profile);
 assert.equal((await moved.api.recheckMissing()).reason,'park-changed');
 assert.deepEqual(moved.rec.profile,backup);
 assert.deepEqual(moved.rec.acceptedResult,moved.accepted);
 const failed=fixture({throwService:true});
 const before=structuredClone(failed.rec.profile);
 assert.equal((await failed.api.recheckMissing()).reason,'service-error');
 assert.deepEqual(failed.rec.profile,before);
 assert.deepEqual(failed.rec.corrections,{'90:90':failed.manual});
 assert.ok(!failed.events.includes('save'));
});
test('locked source unchanged; targeted retry is opt-in inside existing draft analysis panel, not another menu',()=>{
 const source=read('src/ui/gis-water-neighbour.js');
 const lock=JSON.parse(read('docs/surface-engine-lock.json'));
 assert.equal(Object.keys(lock.locked_files).length,51);
 assert.ok(!lock.locked_files['src/ui/gis-water-neighbour.js']);
 assert.ok(lock.locked_files['src/ui/lc-sens.js']);
 assert.match(source,/const section=document\.getElementById\("dgUxDraftSave"\)/);
 assert.match(source,/row\.append\(button\)/);
 assert.doesNotMatch(source,/createElement\("details"\)|\.acceptedResult\s*=|\.corrections\[key\]\s*=/);
});

test('fresh scan automatically attempts exactly one evidence-backed follow-up, without repeated requests',async()=>{
 const f=fixture();
 f.api.maybeRecheckAfterScan();
 f.api.maybeRecheckAfterScan();
 await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(f.events.filter(e=>Array.isArray(e)&&e[0]==='profile').length,1);
 assert.equal(f.rec.profile.supplementalSpectral.cellsResolved,40);
 f.api.maybeRecheckAfterScan();
 await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(f.events.filter(e=>Array.isArray(e)&&e[0]==='profile').length,1,'never launch repeated Sentinel downloads on UI rerenders');
});
test('ongoing drawing or scan never launches automatic pixel review',async()=>{
 for(const state of [{busy:true},{draw:{ring:[]}},{brush:{type:'hard'}},{editing:false}]){
  const f=fixture();Object.assign(f.state,state);
  f.api.maybeRecheckAfterScan();
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(f.events.length,0,'non-idle review must not start remote scan');
 }
});

test('real startup order: water retry attaches to lcSens CREATED AFTER DOMContentLoaded',async()=>{
 const observers=[],callbacks={};let host=null,profileCalls=0;
 const park={id:'parkInfo'},status={textContent:''},timeouts=[];
 class Observer{
  constructor(cb){this.cb=cb;observers.push(this);}
  observe(node,options){this.node=node;this.options=options;}
  disconnect(){this.disconnected=true;}
  trigger(){this.cb([]);}
 }
 const rec={id:'dynamic-park',fingerprint:'verified',scannedAt:null,
  period:'latest',profile:{cells:{}},corrections:{},features:[]};
 const s={record:rec,geometry:{ready:true},editing:true,busy:false,
  saving:false,exporting:false,rawView:false,draw:null,brush:null,
  epoch:3,partitionVersion:1,visualVersion:0};
 const cell={row:1,col:1,areaM2:100,rasterClassKey:'water',classKey:'water',center:{lat:39.95,lon:32.64}};
 const ctx={
  window:{DG_LC_SENS:{state:s},DG_LC_S2:{profile:async()=>{
   profileCalls++;
   return {cells:{'1:1':{obs:4,ndvi:.62,mndwi:-.19,ndbi:-.3}},evidenceVersion:'QA'};
  }},DG_LC_VALIDATE:{spectralLandPredict:v=>v?.obs>=3?'green':'nodata'}},
  document:{readyState:'loading',addEventListener:(n,cb)=>{callbacks[n]=cb;},
   getElementById:id=>id==='parkInfo'?park:id==='lcSens'?host:id==='dgUxDraftStatus'?status:null},
  MutationObserver:Observer,
  setTimeout:cb=>{timeouts.push(cb);return timeouts.length;},
  clearTimeout(){},console,Date,
  dgSensParts:()=>[{key:'1:1',cell,method:'review-cell',
   type:rec.profile.cells['1:1']?'green':'other',areaM2:100}],
  dgSensDirty(){s.editing=true;s.visualVersion++;},
  dgSensRefreshLayer(){return Promise.resolve();},
  dgSensUpdateSummary(){},
  dgSensSave(){return Promise.resolve(true);},
  dgSensWaterBoundaryUnresolved:()=>rec.profile.cells['1:1']?0:1
 };
 vm.runInNewContext(read('src/ui/gis-water-neighbour.js'),ctx);
 callbacks.DOMContentLoaded();
 assert.equal(observers.length,1,'park container observed even when lcSens does not exist');
 assert.equal(observers[0].node,park);
 assert.equal(profileCalls,0);
 host={id:'lcSens'};
 observers[0].trigger();
 assert.equal(observers.length,2,'new scientific panel is now observed');
 assert.equal(observers[1].node,host);
 assert.equal(observers[1].options.subtree,false,'panel observation is cheap');
 while(timeouts.length)timeouts.shift()();
 assert.equal(profileCalls,0,'no auto request before source scan');
 rec.scannedAt='2026-10-08T18:00:00Z';
 observers[1].trigger();
 while(timeouts.length)timeouts.shift()();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(profileCalls,1,'first real scan triggers the missing retry');
 assert.equal(rec.profile.cells['1:1'].obs,4);
 assert.match(status.textContent,/bilimsel olarak çözülen: 1/);
 observers[1].trigger();
 while(timeouts.length)timeouts.shift()();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(profileCalls,1,'re-render never triggers redundant rechecks');
 host={id:'lcSens-new'};
 observers[0].trigger();
 assert.equal(observers[1].disconnected,true);
 assert.equal(observers.at(-1).node,host,'switching parks reattaches instead of keeping stale node');
});
test('draft UI also registers parkInfo watcher when lcSens is created after load',()=>{
 const observers=[],callbacks={},park={id:'parkInfo'};
 let host=null;
 class Observer{
  constructor(cb){this.cb=cb;observers.push(this);}
  observe(node,options){this.node=node;this.options=options;}
  disconnect(){this.disconnected=true;}
  trigger(){this.cb([]);}
 }
 const ctx={window:{DG_LC_SENS:{state:{}}},console,Date,setTimeout,clearTimeout,
  document:{readyState:'loading',addEventListener:(n,cb)=>{callbacks[n]=cb;},
   getElementById:id=>id==='parkInfo'?park:id==='lcSens'?host:null},
  MutationObserver:Observer};
 vm.runInNewContext(read('src/ui/gis-project-draft.js'),ctx);
 callbacks.DOMContentLoaded();
 assert.equal(observers.length,1);
 assert.equal(observers[0].node,park);
 host={id:'lcSens',querySelector:()=>null};
 observers[0].trigger();
 assert.equal(observers.length,2);
 assert.equal(observers[1].node,host);
 host={id:'lcSens-2',querySelector:()=>null};
 observers[0].trigger();
 assert.equal(observers[1].disconnected,true);
 assert.equal(observers.at(-1).node,host);
});
