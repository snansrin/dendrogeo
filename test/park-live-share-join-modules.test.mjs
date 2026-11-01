import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const modules=[
  'src/domain/parks/resolve-live-share-join.js',
  'src/adapters/parks/fetch-live-share-project-park.js',
  'src/ui/park-live-share-connection-status.js',
  'src/application/parks/handle-live-share-channel-status.js',
  'src/application/parks/join-live-share-park.js'
];
function app(){const context=vm.createContext({window:{},String});for(const path of modules)vm.runInContext(read(path),context,{filename:path});return context.window;}

test('park join resolution preserves guards, empty park handling, reuse, and transition decisions',()=>{
  const resolve=app().DG_RESOLVE_LIVE_SHARE_JOIN.resolve;
  const base={enabled:true,hasUser:true,hasClient:true,projectId:7};
  assert.equal(resolve({...base,enabled:false}).action,'skip');
  assert.equal(resolve({...base,projectId:0}).action,'leave');
  assert.equal(resolve(base).action,'read-park');
  assert.equal(resolve({...base,parkResolved:true,parkId:0}).action,'leave');
  assert.equal(resolve({...base,parkResolved:true,parkId:9,currentParkId:9,hasChannel:true}).action,'reuse');
  assert.deepEqual(JSON.parse(JSON.stringify(resolve({...base,parkResolved:true,parkId:9}))),{action:'join',parkId:9});
});

test('project park adapter preserves the existing select, id filter, maybeSingle, and park fallback',async()=>{
  const fetch=app().DG_FETCH_LIVE_SHARE_PROJECT_PARK.fetch,events=[];
  const client={from:table=>{events.push(['from',table]);return{select:columns=>{events.push(['select',columns]);return{eq:(field,id)=>{events.push(['eq',field,id]);return{maybeSingle:async()=>({data:{park_id:9}})};}};}};}};
  assert.equal(await fetch({client,projectId:7}),9);
  assert.deepEqual(events,[['from','projects'],['select','park_id'],['eq','id',7]]);
  const empty={from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:null})})})})};
  assert.equal(await fetch({client:empty,projectId:7}),0);
});

test('join use case preserves read, leave, park assignment, status, and subscription order',async()=>{
  const join=app().DG_JOIN_LIVE_SHARE_PARK.join,events=[];
  const result=await join({enabled:true,user:{id:3},client:{},projectId:7,currentParkId:0,channel:null,
    resolve:input=>app().DG_RESOLVE_LIVE_SHARE_JOIN.resolve(input),readParkId:async id=>{events.push(['read',id]);return 9;},
    leave:()=>events.push('leave'),setParkId:id=>events.push(['park',id]),showConnecting:()=>events.push('connecting'),
    subscribe:ports=>events.push(['subscribe',ports.parkId,ports.userId]),onSync(){},onStatus(){}});
  assert.deepEqual(JSON.parse(JSON.stringify(result)),{status:'joined',parkId:9});
  assert.deepEqual(events,[['read',7],'leave',['park',9],'connecting',['subscribe',9,3]]);
});

test('join skips unavailable sessions and leaves projects without a park',async()=>{
  const join=app().DG_JOIN_LIVE_SHARE_PARK.join,events=[];
  const base={enabled:true,user:{id:3},client:{},projectId:0,currentParkId:0,channel:null,resolve:input=>app().DG_RESOLVE_LIVE_SHARE_JOIN.resolve(input),readParkId:async()=>0,leave:()=>events.push('leave'),setParkId(){},showConnecting(){},subscribe(){},onSync(){},onStatus(){}};
  assert.deepEqual(JSON.parse(JSON.stringify(await join({...base,enabled:false}))),{status:'skipped'});
  assert.deepEqual(JSON.parse(JSON.stringify(await join(base))),{status:'left'});
  assert.deepEqual(events,['leave']);
});

test('switching waypoint projects during the park lookup cannot tear down the newer subscription',async()=>{
  const join=app().DG_JOIN_LIVE_SHARE_PARK.join,events=[];
  let finishRead;
  const pending=new Promise(resolve=>{finishRead=resolve;});
  let selected=7;
  const task=join({enabled:true,user:{id:3},client:{},projectId:7,currentParkId:0,channel:null,
    resolve:input=>app().DG_RESOLVE_LIVE_SHARE_JOIN.resolve(input),readParkId:()=>pending,isCurrent:()=>selected===7,
    leave:()=>events.push('leave'),setParkId:()=>events.push('park'),showConnecting:()=>events.push('connecting'),subscribe:()=>events.push('subscribe')});
  selected=8;
  finishRead(9);
  assert.deepEqual(JSON.parse(JSON.stringify(await task)),{status:'stale'});
  assert.deepEqual(events,[]);
});

test('channel status keeps subscribed side-effect order and routes terminal errors',()=>{
  const handle=app().DG_HANDLE_LIVE_SHARE_CHANNEL_STATUS.handle,events=[];
  const ports={getWatch:()=>42,setWatch:value=>events.push(['watch',value]),clearTimer:value=>events.push(['clear',value]),setLive:value=>events.push(['live',value]),setLastPing:value=>events.push(['last',value]),ping:()=>events.push('ping'),draw:()=>events.push('draw'),fail:()=>events.push('fail')};
  handle('SUBSCRIBED',ports);handle('TIMED_OUT',ports);
  assert.deepEqual(events,[['clear',42],['watch',null],['live',true],['last',0],'ping','draw','fail']);
});

test('connecting UI keeps the existing transient Turkish status',()=>{
  const connecting=app().DG_PARK_LIVE_SHARE_CONNECTION_UI.connecting,element={textContent:''};
  connecting({element,translate:value=>'EN:'+value});
  assert.equal(element.textContent,'EN:⏳ gerçek zamanlı katmana bağlanılıyor…');
  connecting({element:null,translate:value=>value});
});

test('all five live-share modules load before the locked service and are precached',()=>{
  const head=read('partials/head.html'),sw=read('sw.js'),service=head.indexOf('src="src/services/map.js');
  for(const path of modules){const tag=`src="${path}?v=`;assert.ok(head.includes(tag),`${path} script`);assert.ok(head.indexOf(tag)<service,`${path} load order`);assert.ok(sw.includes(`'/${path}'`),`${path} precache`);}
});
