import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const modules=[
  'src/domain/trees/build-live-measurement-preview-input.js',
  'src/application/trees/calculate-live-measurement-preview.js',
  'src/ui/render-live-measurement-preview.js',
  'src/domain/trees/resolve-measurement-point-query.js',
  'src/application/trees/query-measurement-point.js'
];
function app(){const context=vm.createContext({window:{}});for(const path of modules)vm.runInContext(read(path),context,{filename:path});return context.window;}

test('live preview parses form values, validates before calculation, and preserves output formatting',()=>{
  const window=app(),events=[],element={style:{},innerHTML:'old'},hint={style:{}};
  const request=window.DG_BUILD_LIVE_MEASUREMENT_PREVIEW_INPUT.build({circumference:'35.5',height:'12',species:'KARAÇAM',group:'İBRELİ'});
  assert.deepEqual(JSON.parse(JSON.stringify(request)),{circumferenceCm:35.5,heightM:12,species:'KARAÇAM',group:'İBRELİ'});
  const preview=window.DG_CALCULATE_LIVE_MEASUREMENT_PREVIEW.calculate({input:()=>request,validate:value=>{events.push(['validate',value]);return{valid:true};},calculate:value=>{events.push(['calculate',value]);return{valid:true,total_carbon:18.26,dbh_cm:11.3,agb:22.4,bhb:3.6,vol:.045,density_kg_m3:510};}});
  window.DG_RENDER_LIVE_MEASUREMENT_PREVIEW.render({preview,element,getHint:()=>hint,translate:value=>value});
  assert.deepEqual(events.map(x=>x[0]),['validate','calculate']);
  assert.equal(element.style.display,'block');assert.equal(hint.style.display,'none');
  assert.match(element.innerHTML,/Tahmini karbon · 18\.3 kg/);
  assert.match(element.innerHTML,/35\.5 cm → DBH 11\.3 cm/);
  assert.match(element.innerHTML,/Hacim 0\.045 m³/);
});

test('invalid biometrics hide preview; a valid gate with invalid calculation keeps the old empty preview surface',()=>{
  const window=app(),element={style:{},innerHTML:'old'},hint={style:{}};
  const invalid=window.DG_CALCULATE_LIVE_MEASUREMENT_PREVIEW.calculate({input:()=>({}),validate:()=>({valid:false}),calculate:()=>{throw Error('must not calculate');}});
  window.DG_RENDER_LIVE_MEASUREMENT_PREVIEW.render({preview:invalid,element,getHint:()=>hint,translate:String});
  assert.equal(element.style.display,'none');assert.equal(hint.style.display,'block');assert.equal(element.innerHTML,'old');
  const empty=window.DG_CALCULATE_LIVE_MEASUREMENT_PREVIEW.calculate({input:()=>({circumferenceCm:10}),validate:()=>({valid:true}),calculate:()=>({valid:false})});
  window.DG_RENDER_LIVE_MEASUREMENT_PREVIEW.render({preview:empty,element,getHint:()=>hint,translate:String});
  assert.equal(element.style.display,'block');assert.equal(hint.style.display,'none');assert.equal(element.innerHTML,'old');
});

test('point query hides incomplete input, discards stale responses, and returns the renderer result',async()=>{
  const window=app(),events=[];
  const query=window.DG_QUERY_MEASUREMENT_POINT;
  const common={resolve:window.DG_RESOLVE_MEASUREMENT_POINT_QUERY.resolve,read:async target=>{events.push(['read',target]);return{species:'KARAÇAM'};},isCurrent:()=>true,hide:()=>events.push(['hide']),render:(record,id)=>{events.push(['render',id,record.species]);return'id:'+id;}};
  assert.equal(await query.query({...common,projectId:0,pointId:3}),undefined);
  assert.equal(await query.query({...common,projectId:7,pointId:3,isCurrent:()=>false}),undefined);
  assert.equal(await query.query({...common,projectId:7,pointId:3}),'id:3');
  assert.equal(JSON.stringify(events),JSON.stringify([['hide'],['read',{projectId:7,pointId:3}],['read',{projectId:7,pointId:3}],['render',3,'KARAÇAM']]));
});

test('five modules load before measure.js and are available in the service-worker precache',()=>{
  const head=read('partials/head.html'),worker=read('sw.js'),service=head.indexOf('src/services/measure.js');
  for(const path of modules){const index=head.indexOf(path);assert.ok(index>=0&&index<service,path+' must load before measure.js');assert.ok(worker.includes("'/"+path+"'"),path+' must be precached');}
  const source=read('src/services/measure.js');
  assert.ok(source.includes('DG_CALCULATE_LIVE_MEASUREMENT_PREVIEW'));
  assert.ok(source.includes('DG_QUERY_MEASUREMENT_POINT'));
});
