import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const service=read('src/services/measure.js');
const modules=[
  'src/adapters/trees/measurement-geolocation.js',
  'src/ui/measurement-gps-status.js',
  'src/application/trees/handle-measurement-gps-error.js',
  'src/adapters/trees/measurement-wake-lock.js',
  'src/application/trees/start-measurement-gps.js'
];
function setup(){const window={};const context=vm.createContext({window});for(const path of modules)vm.runInContext(read(path),context,{filename:path});return{window,context};}

test('geolocation adapter isolates permission, one-shot fix and live watch APIs',async()=>{
  const calls=[];const nav={permissions:{query:async value=>{calls.push(['permission',value.name]);return{state:'denied'};}},geolocation:{getCurrentPosition(...args){calls.push(['current',...args]);},watchPosition(...args){calls.push(['watch',...args]);}}};
  const{window}=setup();const api=window.DG_MEASUREMENT_GEOLOCATION_ADAPTER.create({getNavigator:()=>nav});
  assert.equal(api.isAvailable(),true);assert.equal(await api.permissionState(),'denied');api.getCurrentPosition(()=>{},()=>{},{timeout:1});api.watchPosition(()=>{},()=>{},{maximumAge:1000});
  assert.equal(calls[0][0],'permission');assert.equal(calls[1][0],'current');assert.equal(calls[2][0],'watch');
  assert.equal(window.DG_MEASUREMENT_GEOLOCATION_ADAPTER.create({getNavigator:()=>({})}).isAvailable(),false);
});

test('GPS status UI preserves idle state and resets the retry controls only on errors',()=>{
  const events=[];const{window}=setup();const state={textContent:'',className:''},button={dataset:{},classList:{remove:value=>events.push(['remove',value])}},badge={};
  const ports={element:id=>({gpsState:state,gpsBtn:button,gpsBadge:badge})[id]||null,setBusy:value=>events.push(['busy',value]),notify:value=>events.push(['notify',value])};
  window.DG_MEASUREMENT_GPS_STATUS_UI.show('Konum alınıyor…',false,ports);
  assert.equal(state.textContent,'Konum alınıyor…');assert.equal(events.length,0);
  window.DG_MEASUREMENT_GPS_STATUS_UI.show('İzin reddedildi',true,ports);
  assert.equal(state.className,'alert err');assert.equal(button.textContent,'📡 Konumu Tekrar Dene');assert.equal(badge.textContent,'konum kapalı');
  assert.deepEqual(events.map(event=>Array.isArray(event)?event[0]:event),['busy','remove','notify']);
});

test('GPS error handling preserves permission denial, timeout retry and generic errors',()=>{
  const{window}=setup();const events=[];const handle=window.DG_HANDLE_MEASUREMENT_GPS_ERROR.handle;
  const ports={showStatus:(...args)=>events.push(['status',...args]),retry:failed=>{events.push('retry');failed();}};
  handle({code:1},ports);handle({code:3},ports);handle({code:2,message:'unavailable'},ports);
  assert.deepEqual(events.map(event=>Array.isArray(event)?event[0]:event),['status','retry','status','status']);
  assert.equal(events[0][1],'İzin reddedildi. iPhone: Ayarlar→Safari→Konum→Kullanırken İzin Ver.');
  assert.equal(events[2][1],'GPS başarısız: dışarıda tekrar deneyin.');
  assert.equal(events[3][1],'GPS hatası: unavailable');
});

test('wake-lock adapter avoids duplicate requests and allows a released lock to be reacquired',async()=>{
  const{window}=setup();let count=0,release;const nav={wakeLock:{request:async()=>{count++;return{addEventListener:(name,handler)=>{assert.equal(name,'release');release=handler;}};}}};
  const api=window.DG_MEASUREMENT_WAKE_LOCK_ADAPTER.create({getNavigator:()=>nav});
  await api.acquire();await api.acquire();assert.equal(count,1);release();await api.acquire();assert.equal(count,2);
  await window.DG_MEASUREMENT_WAKE_LOCK_ADAPTER.create({getNavigator:()=>({})}).acquire();
});

test('wake-lock adapter owns visibility subscription and ignores hidden transitions',()=>{
  const{window}=setup();let listener,removals=0,visible=0;
  const document={visibilityState:'hidden',addEventListener:(name,callback)=>{assert.equal(name,'visibilitychange');listener=callback;},removeEventListener:()=>removals++};
  const api=window.DG_MEASUREMENT_WAKE_LOCK_ADAPTER.create({getNavigator:()=>({}),getDocument:()=>document});
  const dispose=api.bindVisibility(()=>visible++);listener();document.visibilityState='visible';listener();dispose();
  assert.equal(visible,1);assert.equal(removals,1);
});

test('GPS activation preserves permission/status/busy order and updates each live fix',async()=>{
  const{window}=setup();const events=[];let firstFix,liveFix,options;
  const geolocation={isAvailable:()=>true,permissionState:async()=> 'prompt',getCurrentPosition:(success,error,value)=>{firstFix=success;options=value;events.push('request');},watchPosition:(success)=>{liveFix=success;events.push('watch');}};
  await window.DG_START_MEASUREMENT_GPS.start({geolocation,isIOS:()=>true,showIOSHint:()=>events.push('ios-hint'),showStatus:(message,error)=>events.push(['status',message,error]),setBusy:value=>events.push(['busy',value]),setGPS:coords=>events.push(['gps',coords.latitude]),updateGPS:()=>events.push('update'),liveSharePing:()=>events.push('live'),presencePing:()=>events.push('presence'),acquireWakeLock:()=>events.push('wake'),handleError:(error,ports)=>window.DG_HANDLE_MEASUREMENT_GPS_ERROR.handle(error,ports)});
  assert.deepEqual(events.slice(0,5).map(event=>Array.isArray(event)?event[0]:event),['ios-hint','status','busy','request']);
  assert.equal(options.enableHighAccuracy,true);assert.equal(options.timeout,15000);assert.equal(options.maximumAge,0);
  firstFix({coords:{latitude:40}});
  assert.deepEqual(events.slice(4).map(event=>Array.isArray(event)?event[0]:event),['busy','gps','update','live','presence','wake','watch']);
  liveFix({coords:{latitude:41}});assert.equal(events.at(-4)[0],'gps');assert.equal(events.at(-4)[1],41);
});

test('GPS modules load before measure and the service composes the modular GPS use case',()=>{
  const head=read('partials/head.html'),sw=read('sw.js'),measure=head.indexOf('src/services/measure.js');
  for(const path of modules){assert.ok(head.indexOf(path)>=0&&head.indexOf(path)<measure,`${path} load order`);assert.ok(sw.includes(`'/${path}'`),`${path} precache`);}
  assert.ok(service.includes('DG_START_MEASUREMENT_GPS.start'));
  assert.ok(service.includes('iPhone kullanıcısı mısınız?'));
  assert.ok(service.includes('DG_MEASUREMENT_GEOLOCATION_ADAPTER.create'));
  assert.ok(!service.includes('navigator.geolocation.watchPosition'));
});
