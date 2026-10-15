import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../src/ui/admin-maintenance-actions.js',import.meta.url),'utf8');

test('admin maintenance buttons delegate to the existing actions',()=>{
 const listeners=new Map(),calls=[],window={};
 for(const name of ['cleanOrphans','reGeocodeAll','backfillParks'])window[name]=function(){calls.push([name,this===window]);};
 const document={addEventListener:(name,handler)=>listeners.set(name,handler)};
 vm.runInContext(source,vm.createContext({window,document}));
 for(const action of ['clean-orphans','re-geocode','backfill-parks']){
  const element={dataset:{dgMaintenanceAction:action}};
  listeners.get('click')({target:{closest:()=>element}});
 }
 assert.deepEqual(calls.map(([name])=>name),['cleanOrphans','reGeocodeAll','backfillParks']);
 assert.ok(calls.every(([,receiver])=>receiver));
});

test('maintenance commands are declarative and loaded offline',()=>{
 const shell=readFileSync(new URL('../partials/shell.html',import.meta.url),'utf8');
 const boot=readFileSync(new URL('../partials/boot.html',import.meta.url),'utf8');
 const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 const view=shell.slice(shell.indexOf('id="storeInfo"'),shell.indexOf('<!-- PARK KİMLİKLERİ'));
 assert.doesNotMatch(view,/\bon(?:click|change|input|submit)\s*=/i);
 assert.match(view,/data-dg-maintenance-action="clean-orphans"/);
 assert.match(view,/data-dg-maintenance-action="re-geocode"/);
 assert.match(view,/data-dg-maintenance-action="backfill-parks"/);
 assert.match(boot,/src\/ui\/admin-maintenance-actions\.js/);
 assert.match(sw,/\/src\/ui\/admin-maintenance-actions\.js/);
});
