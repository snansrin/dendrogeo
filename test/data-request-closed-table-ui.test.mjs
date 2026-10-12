import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const window={};
class Clock{constructor(value){this.value=value;}toLocaleDateString(locale){assert.equal(locale,'tr-TR');return this.value==='close'?'13.10.2026':'12.10.2026';}}
vm.runInNewContext(readFileSync(new URL('../src/ui/data-request-closed-table.js',import.meta.url),'utf8'),{window,Date:Clock});
const render=window.DG_DATA_REQUEST_CLOSED_TABLE_UI.render;
const escape=value=>value==null?'':String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');

test('closed request table preserves closure labels, dates, badges and escaped notes',()=>{
 const box={},row={id:7,profiles:{full_name:'<Ada>'},country:'TR',project_name:'<Park>',created_at:'created',fulfilled_at:'close',status:'Tamamlandı',note:'<note>'},before=JSON.stringify(row);
 render(box,[row],{escape});
 assert.match(box.innerHTML,/data-label="Kapanış">13\.10\.2026/);assert.match(box.innerHTML,/data-label="Talep">12\.10\.2026/);
 assert.match(box.innerHTML,/&lt;Ada&gt;/);assert.match(box.innerHTML,/&amp;lt;Park&amp;gt;/);assert.match(box.innerHTML,/&lt;note&gt;/);assert.match(box.innerHTML,/badge on/);
 assert.equal(JSON.stringify(row),before);assert.doesNotMatch(box.innerHTML,/onclick=/);
});

test('closed request table retains rejected badge, missing closure and whitespace-note fallback',()=>{
 const box={};render(box,[{status:'Reddedildi',note:' '}],{escape});
 assert.match(box.innerHTML,/badge off/);assert.match(box.innerHTML,/data-label="Kapanış"><\/td>/);assert.match(box.innerHTML,/Tüm Veri/);assert.doesNotMatch(box.innerHTML,/📝 Not:/);
});

test('closed request table preserves input order and empty markup',()=>{
 const box={};render(box,[{profiles:{full_name:'First'}},{profiles:{full_name:'Second'}}],{escape});
 assert.ok(box.innerHTML.indexOf('First')<box.innerHTML.indexOf('Second'));render(box,[],{escape});assert.equal(box.innerHTML,'');
});

test('queue store preserves response identity and transport error propagation',async()=>{
 vm.runInNewContext(readFileSync(new URL('../src/adapters/data-requests/queue-store.js',import.meta.url),'utf8'),{window});
 const result={data:[],error:{message:'denied'}},calls=[];
 const client={from(table){calls.push(table);return{select(columns){calls.push(columns);return this;},order(column,options){calls.push([column,JSON.parse(JSON.stringify(options))]);return Promise.resolve(result);}};}};
 assert.equal(await window.DG_DATA_REQUEST_QUEUE_STORE.load(client),result);
 assert.deepEqual(calls,['data_requests','*,profiles(full_name)',['created_at',{ascending:false}]]);
 assert.throws(()=>window.DG_DATA_REQUEST_QUEUE_STORE.load({from(){throw Error('offline');}}),/offline/);
});
