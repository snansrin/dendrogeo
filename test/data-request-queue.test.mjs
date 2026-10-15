import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const window={};
vm.runInNewContext(readFileSync(new URL('../src/domain/data-requests/partition-queue.js',import.meta.url),'utf8'),{window});
vm.runInNewContext(readFileSync(new URL('../src/ui/data-request-pending-table.js',import.meta.url),'utf8'),{window,Date});
for(const file of ['src/adapters/data-requests/queue-store.js','src/ui/data-request-closed-table.js','src/ui/my-data-requests.js','src/application/data-requests/load-queue.js'])vm.runInNewContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),{window,Date});
const partition=window.DG_DATA_REQUEST_QUEUE.partition;

test('request queue preserves exact closed statuses, order and row identities',()=>{
 const rows=['Beklemede','Tamamlandı','İşleme Alındı','Reddedildi','Unknown',null,undefined,'tamamlandı'].map((status,id)=>({status,id}));
 const before=JSON.stringify(rows),result=partition(rows);
 assert.deepEqual(Array.from(result.pending,row=>row.id),[0,2,4,5,6,7]);
 assert.deepEqual(Array.from(result.closed,row=>row.id),[1,3]);
 assert.equal(result.pending[0],rows[0]);assert.equal(result.closed[0],rows[1]);assert.equal(JSON.stringify(rows),before);
 const empty=partition([]);assert.equal(empty.pending.length,0);assert.equal(empty.closed.length,0);
});

function app(data){
 const elements=new Map(),calls=[];for(const id of ['aReqPending','aReqPendingMini','aReqClosed','aReqT','closedReqT','closedRequestsWrap'])elements.set(id,{style:{},innerHTML:'old'});
 const document={getElementById:id=>elements.get(id)};
 const ctx=vm.createContext({window,document,Date,esc:value=>value==null?'':String(value),$:id=>elements.get(id),dgScrollKeep:()=>12,dgScrollRestore:y=>calls.push(['restore',y]),sb:{from(table){calls.push(['from',table]);return{select(columns){calls.push(['select',columns]);return this;},order(column,options){calls.push(['order',column,JSON.parse(JSON.stringify(options))]);return Promise.resolve({data});}};}}});
 vm.runInContext(readFileSync(new URL('../src/services/data-requests.js',import.meta.url),'utf8'),ctx);
 return{elements,calls,run:()=>vm.runInContext('loadRequests()',ctx)};
}

test('queue service preserves query, counters, active/closed rendering and scroll restoration',async()=>{
 const a=app([{id:1,status:'Beklemede',created_at:'2026-10-12T12:00:00Z'},{id:2,status:'Tamamlandı',created_at:'2026-10-12T12:00:00Z'}]);await a.run();
 assert.deepEqual(a.calls,[['from','data_requests'],['select','*,profiles(full_name)'],['order','created_at',{ascending:false}],['restore',12]]);
 assert.equal(a.elements.get('aReqPending').textContent,1);assert.equal(a.elements.get('aReqPendingMini').textContent,1);assert.equal(a.elements.get('aReqClosed').textContent,1);
 assert.match(a.elements.get('aReqT').innerHTML,/data-pending-request-action="fulfill" data-request-id="1"/);assert.match(a.elements.get('closedReqT').innerHTML,/Tamamlandı/);assert.equal(a.elements.get('closedRequestsWrap').style.display,'block');
});

test('queue service retains null-data empty state and hides closed section',async()=>{
 const a=app(null);await a.run();assert.equal(a.elements.get('aReqPending').textContent,0);assert.match(a.elements.get('aReqT').innerHTML,/Bekleyen talep yok/);assert.equal(a.elements.get('closedRequestsWrap').style.display,'none');
});
