import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

test('manual park creation is delegated by the park identity UI',()=>{
 const window={},listeners={},calls=[],document={addEventListener:(name,handler)=>{listeners[name]=handler;},contains:()=>true};
 vm.runInContext(readFileSync(new URL('../src/ui/park-identity.js',import.meta.url),'utf8'),vm.createContext({window}));
 const html=window.DG_PARK_IDENTITY_UI.manualForm({open:true,point:{lat:39,lon:32},document,actions:{create:()=>calls.push('create')}});
 assert.match(html,/data-park-identity-action="create"/);assert.doesNotMatch(html,/\bonclick\s*=/i);
 const button={};listeners.click({target:{closest:selector=>selector==='[data-park-identity-action="create"]'?button:null}});assert.deepEqual(calls,['create']);
});
