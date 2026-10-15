import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../src/ui/data-request-actions.js',import.meta.url),'utf8');

test('data request form actions preserve country, city and submit workflows',()=>{
 const listeners=new Map(),calls=[],window={};
 for(const name of ['reqCountryChanged','reqCityChanged','sendDataRequest'])window[name]=function(){calls.push([name,this===window]);};
 const document={addEventListener:(name,handler)=>listeners.set(name,handler)};
 vm.runInContext(source,vm.createContext({window,document}));
 const dispatch=(type,action)=>{const element={dataset:{dgDataRequestAction:action}};listeners.get(type)({target:{closest:()=>element}});};
 dispatch('change','country');dispatch('change','city');dispatch('click','submit');
 assert.deepEqual(calls.map(([name])=>name),['reqCountryChanged','reqCityChanged','sendDataRequest']);
 assert.ok(calls.every(([,receiver])=>receiver));
});

test('data request markup is declarative and its UI module is precached',()=>{
 const shell=readFileSync(new URL('../partials/shell.html',import.meta.url),'utf8');
 const boot=readFileSync(new URL('../partials/boot.html',import.meta.url),'utf8');
 const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 const view=shell.slice(shell.indexOf('id="v-export"'),shell.indexOf('id="v-world"'));
 assert.doesNotMatch(view,/\bon(?:click|change|input|submit)\s*=/i);
 assert.match(view,/data-dg-data-request-action="country"/);
 assert.match(view,/data-dg-data-request-action="city"/);
 assert.match(view,/data-dg-data-request-action="submit"/);
 assert.match(boot,/src\/ui\/data-request-actions\.js/);
 assert.match(sw,/\/src\/ui\/data-request-actions\.js/);
});
