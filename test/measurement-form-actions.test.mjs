import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../src/ui/measurement-form-actions.js',import.meta.url),'utf8');

test('measurement form events keep the established field callbacks and order',()=>{
  const listeners=new Map(),calls=[];
  const ctx={document:{addEventListener:(name,handler)=>listeners.set(name,handler)},manualPoint:false};
  for(const name of ['cancelEdit','dgProjectChanged','startGps','dgLiveShareToggle','queryPointId','fillSpecies','liveCalc','showLatin','checkPhoto','dgClearMeasurePhoto','saveMeas'])ctx[name]=(...args)=>calls.push([name,...args]);
  ctx.window=ctx;vm.runInContext(source,vm.createContext(ctx));
  const fire=(type,action,extra={})=>{const element={checked:true,dataset:{dgMeasureAction:action},...extra};const event={target:{...extra.event?.target,closest:selector=>selector==='[data-dg-measure-action]'?element:null}};listeners.get(type)(event);return event;};
  fire('click','cancel-edit');fire('change','project-change');fire('click','gps');
  fire('change','live-share');fire('input','manual-point');fire('click','query-point');
  fire('change','group-change');fire('change','species-change');fire('input','live-calc');
  fire('change','photo-check',{event:{target:{files:[{}]}}});fire('click','clear-photo');fire('click','save');
  assert.equal(ctx.manualPoint,true);
  assert.deepEqual(calls.map(([name])=>name),['cancelEdit','dgProjectChanged','startGps','dgLiveShareToggle','queryPointId','fillSpecies','liveCalc','showLatin','liveCalc','liveCalc','checkPhoto','dgClearMeasurePhoto','saveMeas']);
  assert.equal(calls[3][1],true);
  assert.deepEqual(calls[10][1].target.files,[{}]);
});

test('measurement shell has no inline handlers and the event module is ordered/offline',()=>{
  const shell=readFileSync(new URL('../partials/shell.html',import.meta.url),'utf8');
  const start=shell.indexOf('<div class="view" id="v-measure">'),end=shell.indexOf('<div class="view" id="v-nav">',start),view=shell.slice(start,end);
  assert.doesNotMatch(view,/\son(?:click|change|input)\s*=/i);
  assert.match(view,/data-dg-measure-action="manual-point"/);
  const boot=readFileSync(new URL('../partials/boot.html',import.meta.url),'utf8'),sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
  assert.match(boot,/live-map-controls\.js[\s\S]*measurement-form-actions\.js/);
  assert.match(sw,/'\/src\/ui\/measurement-form-actions\.js'/);
});
