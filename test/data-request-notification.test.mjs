import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
function fixture(){
 const elements=new Map(),events={},timers=[];
 const document={visibilityState:'visible',getElementById:id=>elements.get(id),createElement:()=>({style:{},setAttribute(key,value){this[key]=value;}}),addEventListener:(key,fn)=>events[key]=fn};
 elements.set('miAdmin',{appendChild(el){elements.set(el.id,el);}});
 elements.set('adminPendingBadge',{textContent:'3',style:{display:'inline-block'}});
 const window={document,navigator:{onLine:true},addEventListener:(key,fn)=>events[key]=fn,setInterval:(fn,ms)=>timers.push({fn,ms})};
 const context=vm.createContext({window,document,PROFILE:{role:'owner'},USER:{id:'owner'},sb:{},Date,Promise});
 vm.runInContext(source('src/ui/data-request-pending-table.js'),context);
 vm.runInContext(source('src/services/data-requests.js'),context);
 let count=2,error=null,reads=0,resolveRead=null;
 window.DG_ADMIN_PERSISTENCE_STORE={create:()=>({countPendingDataRequests:async()=>{reads++;if(resolveRead)return await resolveRead();return{count,error};}})};
 return{window,context,document,elements,events,timers,refresh:()=>vm.runInContext('dgRefreshDataRequestBadge()',context),resetThrottle:()=>vm.runInContext('DG_REQUEST_BADGE_LAST=0',context),get reads(){return reads;},set count(value){count=value;},set error(value){error=value;},set defer(value){resolveRead=value;}};
}

test('request badge appears before opening admin, independently of the measurement badge',async()=>{
 const f=fixture();await f.refresh();
 const badge=f.elements.get('adminDataRequestBadge');assert.equal(badge.style.display,'inline-block');assert.equal(badge.textContent,'2');assert.equal(badge.className,'dg-menu-badge');assert.match(badge['aria-label'],/2 veri talebi/);
 assert.equal(f.elements.get('adminPendingBadge').textContent,'3');
 f.window.DG_DATA_REQUEST_PENDING_TABLE_UI.updateCounts(f.document,[]);
 assert.equal(badge.style.display,'none');assert.equal(f.elements.get('adminPendingBadge').style.display,'inline-block');
 f.window.DG_DATA_REQUEST_PENDING_TABLE_UI.updateCounts(f.document,Array(105).fill({}));assert.equal(badge.textContent,'99+');
});

test('notification reads are admin-only, deduplicated and throttled',async()=>{
 const f=fixture();await Promise.all([f.refresh(),f.refresh()]);assert.equal(f.reads,1);await f.refresh();assert.equal(f.reads,1);
 for(const profile of [null,{role:'user'}]){f.context.PROFILE=profile;f.resetThrottle();await f.refresh();assert.equal(f.reads,1);assert.equal(f.elements.get('adminDataRequestBadge').style.display,'none');}
});

test('network failures preserve notifications and logout discards in-flight counts',async()=>{
 const f=fixture();await f.refresh();f.error=Error('denied');f.resetThrottle();await f.refresh();assert.equal(f.elements.get('adminDataRequestBadge').textContent,'2');
 let release;f.defer=()=>new Promise(resolve=>release=resolve);f.resetThrottle();const pending=f.refresh();await Promise.resolve();await Promise.resolve();
 f.context.PROFILE=null;await f.refresh();release({count:8,error:null});await pending;
 assert.equal(f.elements.get('adminDataRequestBadge').style.display,'none');
});

test('lightweight polling pauses in hidden tabs/offline and refreshes when focused',async()=>{
 const f=fixture();assert.equal(f.timers.length,1);assert.equal(f.timers[0].ms,60000);
 f.document.visibilityState='hidden';f.timers[0].fn();await Promise.resolve();assert.equal(f.reads,0);
 f.document.visibilityState='visible';f.window.navigator.onLine=false;f.events.focus();await Promise.resolve();assert.equal(f.reads,0);
 f.window.navigator.onLine=true;f.events.focus();await f.refresh();assert.equal(f.reads,1);
});

test('request count is HEAD-only and matches active queue statuses including null',async()=>{
 const calls=[],window={};vm.runInNewContext(source('src/adapters/admin/admin-persistence-store.js'),{window});
 const client={from(table){calls.push(['from',table]);return{select(fields,options){calls.push(['select',fields,options]);return{or(filter){calls.push(['or',filter]);return Promise.resolve({count:2,error:null});}};}};}};
 await window.DG_ADMIN_PERSISTENCE_STORE.create(()=>client).countPendingDataRequests();
 assert.deepEqual(JSON.parse(JSON.stringify(calls)),[['from','data_requests'],['select','id',{count:'exact',head:true}],['or','status.is.null,status.not.in.("Tamamlandı","Reddedildi")']]);
});

test('failed queue reads cannot clear a pending notification',async()=>{
 const window={};vm.runInNewContext(source('src/application/data-requests/load-queue.js'),{window});let updated=false;
 await window.DG_LOAD_DATA_REQUEST_QUEUE.execute({load:async()=>({data:null,error:Error('offline')}),partition:()=>{throw Error('must not partition failed reads');},updateCounts:()=>updated=true});
 assert.equal(updated,false);
});
