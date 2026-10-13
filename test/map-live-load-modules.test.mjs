import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const modules=[
  'src/domain/map/prepare-approved-map-measurements.js',
  'src/adapters/map/fetch-approved-map-measurements.js',
  'src/application/map/load-approved-measurement-markers.js',
  'src/ui/render-live-map-load-status.js',
  'src/application/map/load-live-measurements-map.js'
];
function setup(){const window={};const context=vm.createContext({window,Date});for(const path of modules)vm.runInContext(read(path),context,{filename:path});return window;}

test('approved map rows are filtered only through the injected coordinate policy',()=>{
  const prepare=setup().DG_PREPARE_APPROVED_MAP_MEASUREMENTS.prepare;
  const valid=[{lat:39,lon:32},{lat:null,lon:0},{lat:0,lon:0}];
  assert.deepEqual(JSON.parse(JSON.stringify(prepare(valid,(lat,lon)=>Number.isFinite(lat)&&Number.isFinite(lon)))),[{lat:39,lon:32},{lat:0,lon:0}]);
  assert.deepEqual(JSON.parse(JSON.stringify(prepare(null,()=>true))),[]);
});

test('approved measurement adapter keeps the exact query, truncation warning and API error',async()=>{
  const fetch=setup().DG_FETCH_APPROVED_MAP_MEASUREMENTS.fetch,events=[],data=[{id:1}];
  const client={from:table=>({select:(...args)=>{events.push(['select',table,...args]);return{eq:(...filters)=>{events.push(['eq',...filters]);return{limit:async limit=>{events.push(['limit',limit]);return{data,count:3001,error:null};}};}};}})};
  const result=await fetch({client,limit:3000,warnIfTruncated:(...args)=>events.push(['warn',...args])});
  assert.deepEqual(result.data,data); // query results are returned without reshaping
  assert.equal(result.count,3001);
  assert.deepEqual(JSON.parse(JSON.stringify(events)),[['select','measurements','lat,lon,point_id,species,dbh_cm,height_m,carbon_kg,photo_url,grp',{count:'exact'}],['eq','status','Onaylı'],['limit',3000],['warn',data,3000,'Canlı harita',3001]]);
  const failing={from:()=>({select:()=>({eq:()=>({limit:async()=>({data:null,count:null,error:{code:'42501',message:'denied'}})})})})};
  await assert.rejects(()=>fetch({client:failing,limit:3,warnIfTruncated(){}}),/^Error: 42501: denied$/);
});

test('marker application preserves no-map, success and failed-read callback contracts',async()=>{
  const load=setup().DG_LOAD_APPROVED_MEASUREMENT_MARKERS.load,events=[];
  await load({map:null,done:(...args)=>events.push(['done',...args]),fetch(){},prepare(){},draw(){},log:console});
  assert.deepEqual(JSON.parse(JSON.stringify(events.shift())),['done',-1,[],'Harita henüz kurulmadı (initMaps çağrılmadı)']);
  const map={};
  await load({map,limit:5,done:(...args)=>events.push(['done',...args]),readRows:async()=>({data:[1,2]}),prepare:rows=>rows.filter(x=>x===2),draw:(target,rows)=>events.push(['draw',target,...rows]),log:console});
  assert.deepEqual(JSON.parse(JSON.stringify(events)),[['draw',map,2],['done',1,[2],null]]);
  events.length=0;
  await load({map,done:(...args)=>events.push(['done',...args]),readRows:async()=>{throw new Error('42501 denied');},prepare(){},draw(){},log:{error:(...args)=>events.push(['log',...args])}});
  assert.deepEqual(JSON.parse(JSON.stringify(events)),[['log','DENDROGEO · onaylı işaretçiler yüklenemedi:','42501 denied'],['done',-1,[],'42501 denied']]);
});

test('live map status preserves escaped errors, degraded rendering and timeout',()=>{
  const status=setup().DG_RENDER_LIVE_MAP_LOAD_STATUS,element={style:{},textContent:'',innerHTML:''};let timer;
  status.loading(element);assert.deepEqual(element.style,{display:''});assert.equal(element.className,'alert info');
  status.error(element,'<denied>',value=>value.replaceAll('<','&lt;').replaceAll('>','&gt;'));
  assert.equal(element.className,'alert err');assert.match(element.innerHTML,/&lt;denied&gt;/);assert.match(element.innerHTML,/onclick="loadLiveMap\(\)"/);
  status.loaded(element,4,true,(text,values)=>text.replace('{n}',values.n).replace('{t}',values.t),(...args)=>{timer=args;});
  assert.equal(element.className,'alert warn');assert.match(element.textContent,/4 onaylı kayıt yüklendi/);assert.equal(timer[1],6000);timer[0]();assert.equal(element.style.display,'none');
});

test('live map application marks load result and only renders analysis on success',async()=>{
  const app=setup().DG_LOAD_LIVE_MEASUREMENTS_MAP,events=[];
  const status={loading:()=>events.push('loading'),error:(...args)=>events.push(['error',...args]),loaded:(...args)=>events.push(['loaded',...args])};
  await app.load({element:{},loadMarkers:async callback=>callback(2,[{id:1}],null),markLoaded:value=>events.push(['mark',value]),status,escapeHTML:String,format:String,setTimer(){},clusterDegraded:()=>false,renderAnalysis:(...args)=>events.push(['analysis',...args])});
  assert.equal(events[0],'loading');assert.deepEqual(JSON.parse(JSON.stringify(events.slice(1))),[['mark',true],['loaded',{},2,false,null,null],['analysis',[{id:1}],'liveAnalysis']]);
  events.length=0;
  await app.load({element:{},loadMarkers:async callback=>callback(-1,[],'denied'),markLoaded:value=>events.push(['mark',value]),status,escapeHTML:String,format:String,setTimer(){},clusterDegraded:()=>false,renderAnalysis(){events.push('analysis')}});
  assert.equal(events[0],'loading');assert.equal(events[1][0],'mark');assert.equal(events[1][1],false);assert.equal(events[2][0],'error');assert.equal(events.some(x=>x==='analysis'),false);
});

test('load modules precede the locked map service and are included in the offline precache',()=>{
  const head=read('partials/head.html'),sw=read('sw.js'),service=read('src/services/map.js');
  for(const path of modules){assert.ok(head.includes(`src="${path}?v=`),`${path} script`);assert.ok(sw.includes(`'/${path}'`),`${path} precache`);assert.ok(head.indexOf(`src="${path}?v=`)<head.indexOf('src="src/services/map.js?'),`${path} precedes locked service`);}
  assert.match(service,/DG_LOAD_APPROVED_MEASUREMENT_MARKERS/);assert.match(service,/DG_LOAD_LIVE_MEASUREMENTS_MAP/);
});
