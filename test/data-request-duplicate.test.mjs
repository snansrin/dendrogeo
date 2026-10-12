import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const window={};
vm.runInNewContext(readFileSync(new URL('../src/domain/data-requests/find-pending-duplicate.js',import.meta.url),'utf8'),{window});
vm.runInNewContext(readFileSync(new URL('../src/adapters/data-requests/submit-store.js',import.meta.url),'utf8'),{window});
vm.runInNewContext(readFileSync(new URL('../src/application/data-requests/submit-request.js',import.meta.url),'utf8'),{window});
const find=window.DG_DATA_REQUEST_DUPLICATE.find;

test('duplicate request filters preserve whitespace/case normalization and first-match identity',()=>{
 const rows=[{country:' Türkiye ',city:'ANKARA',project_name:' Park ',status:'İşleme Alındı'},{country:'Türkiye',city:'Ankara',project_name:'Park',status:'Beklemede'}];
 const before=JSON.stringify(rows);
 assert.equal(find(rows,{country:'türkiye',city:' ankara ',project_name:'park'}),rows[0]);
 assert.equal(JSON.stringify(rows),before);
});

test('duplicate request filters compare all three fields and retain empty-filter equivalence',()=>{
 const row={country:'TR',city:'Ankara',project_name:'Park'};
 for(const key of ['country','city','project_name'])assert.equal(find([row],{...row,[key]:'other'}),undefined);
 const blank={country:null,city:' ',project_name:undefined};
 assert.equal(find([blank],{country:'',city:null,project_name:''}),blank);
 assert.equal(find(null,{}),undefined);assert.equal(find([],{}),undefined);
 assert.equal(find([{country:7}],{country:'7'}).country,7);
});

test('duplicate rule preserves ordinary lowercase rather than adding locale or accent folding',()=>{
 assert.equal(find([{city:'İSTANBUL'}],{city:'istanbul'}),undefined);
 assert.equal(find([{project_name:'Göksu'}],{project_name:'Goksu'}),undefined);
});

test('duplicate request service preserves query scope and suppresses insertion on a match',async()=>{
 const calls=[],message={style:{}},elements={reqCountry:{value:' TR '},reqCity:{value:' Ankara '},reqProject:{value:' Park '},reqNote:{value:'note'},reqMsg:message};
 const ctx=vm.createContext({window,USER:{id:'user-1',email:'qa@example.test'},PROFILE:{},$:id=>elements[id],toast:()=>calls.push('toast'),console,sb:{from(table){calls.push(['from',table]);return{select(columns){calls.push(['select',columns]);return this;},eq(column,value){calls.push(['eq',column,value]);return this;},in(column,values){calls.push(['in',column,Array.from(values)]);return Promise.resolve({data:[{country:'tr',city:'ankara',project_name:'park',status:'Beklemede'}]});},insert(){assert.fail('duplicate inserted');}};}}});
 vm.runInContext(readFileSync(new URL('../src/services/data-requests.js',import.meta.url),'utf8'),ctx);
 await vm.runInContext('sendDataRequest()',ctx);
 assert.deepEqual(calls.slice(0,4),[['from','data_requests'],['select','country,city,project_name,status'],['eq','user_id','user-1'],['in','status',['Beklemede','İşleme Alındı']]]);
 assert.equal(message.style.color,'var(--amber)');assert.match(message.textContent,/zaten beklemede/);
 assert.equal(elements.reqCountry.value,' TR ');
});
