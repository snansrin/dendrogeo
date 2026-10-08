import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('unavailable OSM mirrors remain quarantined across different queries',async()=>{
 let calls=0,time=0;
 class Clock extends Date{static now(){return time;}}
 const ctx=vm.createContext({Date:Clock,Map,AbortController,setTimeout,clearTimeout,
  console:{log(){},warn(){}},fetch:async()=>{calls++;throw new TypeError('Failed to fetch');}});
 vm.runInContext(source('src/services/osm-client.js'),ctx);
 assert.equal(await vm.runInContext('overpassRequest("first","park")',ctx),null);
 const first=calls;
 assert.ok(first>1);
 assert.equal(await vm.runInContext('overpassRequest("second","park")',ctx),null);
 assert.equal(calls,first);
 time=60001;
 await vm.runInContext('overpassRequest("third","park")',ctx);
 assert.equal(calls,first*2);
 assert.doesNotMatch(source('src/services/osm-client.js'),/private\.coffee|kumi\.systems|openstreetmap\.fr/);
});

test('OSM success after a failed mirror is cached without another request',async()=>{
 let calls=0;
 const ctx=vm.createContext({Date,Map,AbortController,setTimeout,clearTimeout,
  console:{log(){},warn(){}},fetch:async()=>++calls===1?{ok:false,status:406}:
   {ok:true,status:200,json:async()=>({elements:[{id:123}]})}});
 vm.runInContext(source('src/services/osm-client.js'),ctx);
 const first=await vm.runInContext('overpassRequest("park","park")',ctx);
 assert.equal(first.elements[0].id,123);
 assert.equal(await vm.runInContext('overpassRequest("park","park")',ctx),first);
 assert.equal(calls,2);
});

test('Turnstile renders only the selected form and removes the previous widget',()=>{
 const rendered=[],removed=[],scripts=[];
 const elements=Object.fromEntries(['erisim','tsLogin','tsReg','tsReset','fLogin','fReg','fReset'].map(id=>[id,{id,style:{}}]));
 const window={};
 const ctx=vm.createContext({window,$:id=>elements[id],sb:{auth:{onAuthStateChange(){}}},
  document:{readyState:'loading',addEventListener(){},getElementById:id=>elements[id],
   createElement:()=>({remove(){}}),head:{appendChild:s=>scripts.push(s)}},
  console,setTimeout:()=>{throw Error('no background polling');}});
 const auth=source('src/services/auth.js');
 vm.runInContext(auth.slice(0,auth.indexOf('/* --- BLOK 3')),ctx);
 vm.runInContext('initTurnstile()',ctx);
 assert.equal(rendered.length,0);
 vm.runInContext('authTab("login")',ctx);
 assert.equal(scripts.length,1);
 assert.match(scripts[0].src,/render=explicit/);
 ctx.turnstile={render:el=>{rendered.push(el.id);return 'widget-'+el.id;},remove:id=>removed.push(id),getResponse:()=> 'token'};
 scripts[0].onload();
 assert.deepEqual(rendered,['tsLogin']);
 vm.runInContext('initTurnstile();authTab("reg");initTurnstile()',ctx);
 assert.deepEqual(rendered,['tsLogin','tsReg']);
 assert.deepEqual(removed,['widget-tsLogin']);
 assert.equal(vm.runInContext('tsToken("tsReg")',ctx),'token');
 assert.equal(vm.runInContext('tsToken("tsLogin")',ctx),null);
 vm.runInContext('authTab("reset")',ctx);
 assert.deepEqual(rendered,['tsLogin','tsReg','tsReset']);
 assert.equal(scripts.length,1);
});

test('Turnstile resources bypass the Service Worker cache',()=>{
 const handlers=new Map(),responses=[];
 const ctx=vm.createContext({self:{location:{origin:'https://dendrogeo.org'},addEventListener:(name,fn)=>handlers.set(name,fn)},URL,Map,console});
 vm.runInContext(source('sw.js'),ctx);
 ctx.networkOnly=()=> 'network';ctx.staleWhileRevalidate=()=>{throw Error('Turnstile must not be cached');};
 handlers.get('fetch')({request:{method:'GET',url:'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'},respondWith:r=>responses.push(r)});
 assert.deepEqual(responses,['network']);
});

test('font downloads refresh the HTTP cache instead of replaying a corrupt response',async()=>{
 const calls=[];
 const ctx=vm.createContext({self:{location:{origin:'https://dendrogeo.org'},addEventListener(){}},URL,Map,console,
  fetch:async(request,options)=>{calls.push({request,options});return {ok:true};}});
 vm.runInContext(source('sw.js'),ctx);
 await ctx.networkOnly({url:'https://fonts.gstatic.com/s/manrope/font.woff2'});
 await ctx.networkOnly({url:'https://challenges.cloudflare.com/turnstile/v0/api.js'});
 assert.equal(calls[0].options.cache,'reload');
 assert.equal(calls[1].options,undefined);
});
