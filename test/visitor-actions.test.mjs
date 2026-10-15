import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../src/ui/visitor-actions.js',import.meta.url),'utf8');

test('visitor controls delegate legacy workflows with their established arguments',()=>{
 const listeners=new Map(),calls=[],window={};
 for(const name of ['dgVisRefresh','dgVisQuick','dgVisResetFilters','dgVisFit','dgVisActToggle','renderVisitorsLive','dgVisPause','dgVisMapDraw','dgVisFilter','dgVisRows'])
  window[name]=function(...args){calls.push([name,this===window,...args]);return name==='dgVisFilter'?['filtered']:name==='dgVisRows'?['rows']:undefined;};
 const document={addEventListener:(name,handler)=>listeners.set(name,handler)};
 vm.runInContext(source,vm.createContext({window,document}));
 const click=(action,extra={})=>{const element={dataset:{dgVisitorAction:action,...extra}};listeners.get('click')({target:{closest:()=>element}});};
 click('refresh');click('quick-filter',{dgVisitorView:'measure'});click('quick-filter');click('quick-located');click('reset-filters');click('fit-map');click('toggle-activity');
 const input=(eventName,action,checked)=>{const element={dataset:{dgVisitorAction:action},checked};listeners.get(eventName)({target:{closest:()=>element}});};
 input('input','render');input('change','render');input('change','pause',true);input('change','draw-map');
 assert.deepEqual(calls.map(([name])=>name),['dgVisRefresh','dgVisQuick','dgVisQuick','dgVisQuick','dgVisResetFilters','dgVisFit','dgVisActToggle','renderVisitorsLive','renderVisitorsLive','dgVisPause','dgVisRows','dgVisFilter','dgVisMapDraw']);
 assert.ok(calls.every(([,receiver])=>receiver));
 assert.deepEqual(calls.filter(([name])=>name==='dgVisQuick').map(call=>call.slice(2)),[['measure',false],['',false],['',true]]);
 assert.deepEqual(calls.find(([name])=>name==='dgVisPause').slice(2),[true]);
 assert.deepEqual(calls.find(([name])=>name==='dgVisMapDraw').slice(2),[['filtered']]);
});

test('visitor shell actions are declarative and the action module is loaded and precached',()=>{
 const shell=readFileSync(new URL('../partials/shell.html',import.meta.url),'utf8');
 const boot=readFileSync(new URL('../partials/boot.html',import.meta.url),'utf8');
 const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 const visitor=shell.slice(shell.indexOf('id="v-visitors"'),shell.indexOf('id="recoveryModal"'));
 assert.doesNotMatch(visitor,/\bon(?:click|change|input|submit|keydown|keyup)\s*=/i);
 assert.match(visitor,/data-dg-visitor-action="refresh"/);
 assert.match(boot,/src\/ui\/visitor-actions\.js/);
 assert.match(sw,/\/src\/ui\/visitor-actions\.js/);
});
