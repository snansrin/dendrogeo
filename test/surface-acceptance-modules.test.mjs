import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const modules=['src/domain/surface/evaluate-surface-acceptance-gate.js','src/domain/surface/create-surface-acceptance-draft.js','src/application/surface/build-surface-result-snapshot.js','src/application/surface/accept-surface-analysis.js','src/ui/render-surface-accepted-result.js'];
function setup(){const window={};const context=vm.createContext({window,JSON,Error,Math,Object,Promise});for(const path of modules)vm.runInContext(read(path),context,{filename:path});return window;}
function ports(events){const value={epoch:3,sourceRecord:{},getEpoch:()=>3,getRecord:()=>value.sourceRecord,record:{owner:'u',parkId:7},buildResultSnapshot:async()=>({areas:{green:1}}),setSaving:flag=>events.push(`saving:${flag}`),render:()=>events.push('render'),hasIdentity:record=>!!record.owner&&!!record.parkId,saveAccount:async()=>4,getRevision:()=>2,commit:(record,revision)=>events.push(`commit:${revision}`),renderAccepted:()=>events.push('accepted-view'),setEditing:flag=>events.push(`editing:${flag}`),clearFocus:()=>events.push('focus-clear'),saveLocal:async()=>true,setStatus:status=>events.push(`status:${status}`),translate:message=>message,toast:(message,kind)=>events.push(`toast:${kind}`),refresh:()=>events.push('refresh')};return value;}

test('acceptance gate reports the first blocked condition in the established order',()=>{
  const window=setup(),evaluate=window.DG_EVALUATE_SURFACE_ACCEPTANCE_GATE.evaluate,base={record:{},rawView:false,brush:null,busy:false,saving:false,geometry:{},draw:null,unresolvedWater:0};
  assert.match(evaluate({...base,record:null}),/analiz bulunamadı/);assert.match(evaluate({...base,rawView:true}),/Ham görünüm/);assert.match(evaluate({...base,brush:{}}),/Fırça işlemi/);assert.match(evaluate({...base,busy:true}),/işlemi sürüyor/);assert.match(evaluate({...base,geometry:null}),/Park geometrisi/);assert.match(evaluate({...base,draw:{}}),/Sınır çizimi/);assert.match(evaluate({...base,unresolvedWater:2}),/2 raster-su hücresi/);assert.equal(evaluate(base),null);
});

test('acceptance draft freezes corrections while preserving original geometry identities',()=>{
  const window=setup(),features=[{type:'water'}],objectFeatures=[{type:'building'}],record={features,objectFeatures,corrections:{a:{method:'visual-cell',to:'water'}},sens:{green:50}};
  let time=0;const draft=window.DG_CREATE_SURFACE_ACCEPTANCE_DRAFT.create({record,cells:[{key:'a',classKey:'green'},{key:'b',classKey:'hard'}],cellKey:cell=>cell.key,effectiveClass:cell=>cell.key==='b'?'building':'water',editSummary:()=>({total:1}),areas:()=>({water:2,building:3}),timestamp:()=>`t${++time}`});
  assert.equal(draft.features,features);assert.equal(draft.objectFeatures,objectFeatures);assert.equal(draft.corrections.a.to,'water');assert.equal(draft.corrections.b.method,'sensitivity');assert.equal(draft.corrections.b.to,'building');assert.equal(draft.draftDirty,false);assert.deepEqual(JSON.parse(JSON.stringify(draft.acceptedAreas)),{water:2,building:3});assert.equal(draft.modifiedAt,draft.acceptedAt);
});

test('result snapshot verifies total areas before returning publication geometry',async()=>{
  const window=setup(),parts=[{type:'green',areaM2:100}],base={record:{parkId:7,acceptedAt:'time',fingerprint:'f',acceptedAreas:{green:100},profile:{scenes:[1]}},epsg:32636,cells:[{},{}],outer:[[1]],holes:[],parts,parkGeometry:{},visualResult:async()=>({features:['exact'],displayFeatures:['display']}),mergeSync:()=>[],displaySync:()=>[],editSummary:()=>({}),translate:value=>value};
  const snapshot=await window.DG_BUILD_SURFACE_RESULT_SNAPSHOT.build(base);assert.deepEqual(JSON.parse(JSON.stringify(snapshot.features)),['exact']);assert.equal(snapshot.cellCount,2);assert.equal(snapshot.displayMethod.tolerance_m,0);
  await assert.rejects(()=>window.DG_BUILD_SURFACE_RESULT_SNAPSHOT.build({...base,record:{...base.record,acceptedAreas:{green:101}}}),/tüm parkı kapsamıyor/);
});

test('acceptance orchestration saves the account before local cache and clears busy state',async()=>{
  const window=setup(),events=[],p=ports(events);p.sourceRecord={};const result=await window.DG_ACCEPT_SURFACE_ANALYSIS.accept(p);assert.equal(result,true);assert.deepEqual(events.slice(0,4),['saving:true','render','commit:4','accepted-view']);assert.ok(events.indexOf('status:✓ Sonuç hesabınıza kaydedildi; başka cihazda da açılabilir.')<events.indexOf('saving:false'));assert.equal(events.at(-1),'refresh');
});

test('stale acceptance skips account write and failed account save reports local draft fallback',async()=>{
  const window=setup(),staleEvents=[],stale=ports(staleEvents);stale.sourceRecord={};stale.getEpoch=()=>4;let writes=0;stale.saveAccount=async()=>{writes++;};assert.equal(await window.DG_ACCEPT_SURFACE_ANALYSIS.accept(stale),false);assert.equal(writes,0);
  const failEvents=[],failed=ports(failEvents);failed.sourceRecord={};failed.saveAccount=async()=>{throw Error('offline');};assert.equal(await window.DG_ACCEPT_SURFACE_ANALYSIS.accept(failed),false);assert.ok(failEvents.includes('toast:err'));assert.ok(failEvents.some(event=>String(event).includes('Yalnızca cihaz taslağı saklandı')));
});

test('accepted result view escapes report content and hides when result or host is absent',()=>{
  const window=setup(),host={innerHTML:''},render=window.DG_RENDER_SURFACE_ACCEPTED_RESULT.render;
  assert.equal(render({result:null,host}),false);assert.equal(render({result:{},host:null}),false);assert.equal(render({result:{acceptedAt:'t',areas:{green:1}},host,areaBars:()=>'<bars>',escape:value=>String(value).replaceAll('<','&lt;'),translate:value=>`<${value}>`,formatDate:()=>'<date>'}),true);assert.match(host.innerHTML,/&lt;Kayıtlı analiz sonucu>/);assert.match(host.innerHTML,/&lt;date>/);assert.match(host.innerHTML,/<bars>/);
});

test('five acceptance modules load before the legacy surface UI and are precached',()=>{
  const chain=read('src/utils/lazylibs.js'),sw=read('sw.js'),ui=read('src/ui/lc-sens.js');for(const path of modules){assert.ok(chain.includes(`"${path}"`));assert.ok(sw.includes(`'/${path}'`));assert.ok(chain.indexOf(`"${path}"`)<chain.indexOf('"src/ui/lc-sens.js"'));}
  for(const name of ['DG_EVALUATE_SURFACE_ACCEPTANCE_GATE','DG_CREATE_SURFACE_ACCEPTANCE_DRAFT','DG_BUILD_SURFACE_RESULT_SNAPSHOT','DG_ACCEPT_SURFACE_ANALYSIS','DG_RENDER_SURFACE_ACCEPTED_RESULT'])assert.ok(ui.includes(name));
});
