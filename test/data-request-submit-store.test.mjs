import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

function app({pendingError=false,insertError=null}={}){
 const window={},calls=[],elements={reqCountry:{value:' TR '},reqCity:{value:' Ankara '},reqProject:{value:' Park '},reqNote:{value:' note '},reqMsg:{style:{}}};
 const ctx=vm.createContext({window,USER:{id:'qa',email:'user@example.test'},PROFILE:{email:'profile@example.test'},$:id=>elements[id],console:{log(){calls.push(['log']);}},toast:(...args)=>calls.push(['toast',...args]),sb:{from(table){calls.push(['from',table]);const q={select(columns){calls.push(['select',columns]);return q;},eq(column,value){calls.push(['eq',column,value]);return q;},in(column,values){calls.push(['in',column,Array.from(values)]);return pendingError?Promise.reject(Error('offline')):Promise.resolve({data:[]});},insert(body){calls.push(['insert',JSON.parse(JSON.stringify(body))]);return Promise.resolve({error:insertError});}};return q;}}});
 for(const file of ['src/domain/data-requests/find-pending-duplicate.js','src/adapters/data-requests/submit-store.js','src/application/data-requests/submit-request.js','src/ui/data-request-submission-feedback.js','src/services/data-requests.js'])vm.runInContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),ctx);
 ctx.refresh=()=>calls.push(['refresh']);vm.runInContext('loadMyRequests=()=>refresh()',ctx);
 return{calls,elements,run:()=>vm.runInContext('sendDataRequest()',ctx)};
}

test('request submission preserves user/status query, insert body and success flow',async()=>{
 const a=app();await a.run();
 assert.deepEqual(a.calls.slice(0,4),[['from','data_requests'],['select','country,city,project_name,status'],['eq','user_id','qa'],['in','status',['Beklemede','İşleme Alındı']]]);
 assert.deepEqual(a.calls.find(c=>c[0]==='insert')[1],{user_id:'qa',email:'profile@example.test',country:'TR',city:'Ankara',project_name:'Park',note:'note',status:'Beklemede'});
 assert.equal(a.elements.reqMsg.style.color,'var(--green-dk)');
 for(const key of ['reqCountry','reqCity','reqProject','reqNote'])assert.equal(a.elements[key].value,'');
 assert.equal(a.calls.at(-1)[0],'refresh');
});

test('pending-query rejection preserves existing insertion fallback',async()=>{
 const a=app({pendingError:true});await a.run();
 assert.ok(a.calls.some(c=>c[0]==='log'));assert.ok(a.calls.some(c=>c[0]==='insert'));assert.equal(a.calls.at(-1)[0],'refresh');
});

test('insert API error keeps form values and skips refresh',async()=>{
 const a=app({insertError:{message:'denied'}});await a.run();
 assert.equal(a.elements.reqMsg.textContent,'Hata: denied');assert.equal(a.elements.reqMsg.style.color,'var(--red)');
 assert.equal(a.elements.reqNote.value,' note ');assert.equal(a.calls.some(c=>c[0]==='refresh'),false);
});
