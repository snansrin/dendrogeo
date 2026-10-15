import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../src/ui/admin-export-actions.js',import.meta.url),'utf8');

test('admin export controls delegate filters and all three export formats',()=>{
 const listeners=new Map(),calls=[],window={};
 for(const name of ['admCountryChanged','admCityChanged','adminExportCSV','adminExportGeo','adminExportQgis'])window[name]=function(){calls.push([name,this===window]);};
 const document={addEventListener:(name,handler)=>listeners.set(name,handler)};
 vm.runInContext(source,vm.createContext({window,document}));
 const dispatch=(type,action)=>{const element={dataset:{dgAdminExportAction:action}};listeners.get(type)({target:{closest:()=>element}});};
 dispatch('change','country');dispatch('change','city');dispatch('click','csv');dispatch('click','geo');dispatch('click','qgis');
 assert.deepEqual(calls.map(([name])=>name),['admCountryChanged','admCityChanged','adminExportCSV','adminExportGeo','adminExportQgis']);
 assert.ok(calls.every(([,receiver])=>receiver));
});

test('admin export controls are declarative and included in offline assets',()=>{
 const shell=readFileSync(new URL('../partials/shell.html',import.meta.url),'utf8');
 const boot=readFileSync(new URL('../partials/boot.html',import.meta.url),'utf8');
 const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 const view=shell.slice(shell.indexOf('id="v-admin"'),shell.indexOf('id="v-users"'));
 const exportCard=view.slice(view.indexOf('admExpCountry'),view.indexOf('aReqT'));
 assert.doesNotMatch(exportCard,/\bon(?:click|change|input|submit)\s*=/i);
 assert.match(exportCard,/data-dg-admin-export-action="country"/);
 assert.match(exportCard,/data-dg-admin-export-action="city"/);
 assert.match(exportCard,/data-dg-admin-export-action="csv"/);
 assert.match(boot,/src\/ui\/admin-export-actions\.js/);
 assert.match(sw,/\/src\/ui\/admin-export-actions\.js/);
});
