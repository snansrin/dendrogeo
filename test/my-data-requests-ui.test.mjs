import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

test('own data request deletion uses the list container action port',()=>{
 const window={},listeners={},calls=[],element={innerHTML:'',addEventListener:(name,handler)=>{listeners[name]=handler;},contains:()=>true};
 vm.runInContext(readFileSync(new URL('../src/ui/my-data-requests.js',import.meta.url),'utf8'),vm.createContext({window}));
 window.DG_MY_DATA_REQUESTS_UI.render(element,[{id:7,country:'Türkiye',city:'Ankara',project_name:'Park',created_at:'2026-01-01'}],{actions:{delete:id=>calls.push(id)}});
 assert.match(element.innerHTML,/data-request-list-action="delete" data-request-id="7"/);assert.doesNotMatch(element.innerHTML,/\bonclick\s*=/i);
 const button={dataset:{requestId:'7'}};listeners.click({target:{closest:selector=>selector==='[data-request-list-action="delete"]'?button:null}});assert.deepEqual(calls,[7]);
});
