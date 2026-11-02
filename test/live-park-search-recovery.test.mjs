import {test} from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const read=path=>readFileSync(path,'utf8');
test('actual park query reaches the second provider after 502 without changing park geometry',async()=>{
 const urls=[],rings={outer:[[[39,32],[39,33],[40,33],[40,32],[39,32]]],inner:[]};let fallbacks=0;
 const c=vm.createContext({window:null,Map,Date,Promise,AbortController,setTimeout,clearTimeout,console:{log(){},warn(){}},fetch:async url=>{urls.push(url);return urls.length===1?{ok:false,status:502}:{ok:true,json:async()=>({elements:[{type:'way',id:55,tags:{name:'Büyük park'},rings}]})};},extractRings:e=>e.rings,polyArea:()=>2500000,pointInPark:()=>true,dgParkBoundaryFallback:async()=>{fallbacks++;return[];}});c.window=c;
 for(const path of ['src/adapters/parks/post-overpass-query.js','src/domain/parks/select-overpass-mirrors.js','src/adapters/parks/overpass-mirror-health.js','src/domain/parks/overpass-request-budget.js','src/services/osm-client.js','src/application/parks/find-park-candidates.js'])vm.runInContext(read(path),c);
 vm.runInContext(read('src/services/park-query.js').split('/* A geocoding result')[0],c);
 const parks=await c.queryPark(39.5,32.5);assert.equal(parks[0].rings,rings);assert.equal(parks[0].id,55);assert.equal(fallbacks,0);assert.equal(urls.length,2);assert.match(urls[1],/maps.mail.ru/);
});
test('persistent park search submits by name, prevents duplicate requests and preserves active drawing',async()=>{
 const listeners={},button={disabled:false},input={value:'  Büyük park, Ankara  '},status={textContent:''};let release,calls=0;
 const form={querySelector:s=>s==='#dgLiveParkName'?input:s==='#dgLiveParkSearchStatus'?status:button};
 const document={addEventListener:(name,handler)=>listeners[name]=handler},window={dgScanSearchByName:async name=>{assert.equal(name,'Büyük park, Ankara');calls++;await new Promise(r=>release=r);}};
 vm.runInNewContext(read('src/ui/live-map-controls.js'),{window,document});const event={target:{closest:()=>form},preventDefault(){}};
 const pending=listeners.submit(event);assert.equal(button.disabled,true);await listeners.submit(event);assert.equal(calls,1);release();await pending;assert.equal(button.disabled,false);
 window.DG_LC_SENS={state:{brush:true}};await listeners.submit(event);assert.equal(calls,1);assert.match(status.textContent,/korunuyor/);
});
test('saved-project disclosure and park search remain independent in the live map shell',()=>{
 const html=read('partials/shell.html');assert.match(html,/<details id="dgLiveProjects"[^>]*>[\s\S]*?<summary[^>]*>[\s\S]*?dgLiveProjectsTitle/);assert.match(html,/<\/details>\s*<form id="dgLiveParkSearch"/);assert.match(html,/<label[^>]*for="dgLiveParkName"/);assert.match(html,/type="submit"[^>]*>🔍 Park ara/);
});

test('scan card keeps legacy search only when the permanent live search is absent',()=>{
 for(const permanent of [false,true]){
  const element={style:{},innerHTML:'',addEventListener(){}};
  const window={document:{getElementById:()=>permanent?{}:null}};
  vm.runInNewContext(read('src/ui/park-scan-card.js'),{window});
  window.DG_PARK_SCAN_CARD_UI.render({element,park:null,candidate:null,showManual:false,scanActive:true,schemaWarning:'',step:1,isAdmin:false,projects:[],escape:String,formatArea:String,manualForm:()=>'',labelFromLegacy:()=>'',projectName:()=>''});
  assert.equal(element.innerHTML.includes('id="scanRemote"'),!permanent);
 }
});
