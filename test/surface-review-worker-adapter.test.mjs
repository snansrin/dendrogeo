import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/adapters/surface/review-worker.js',import.meta.url),'utf8');
function setup(options={}){
  const window={};const ctx=vm.createContext({window,setTimeout,clearTimeout});
  vm.runInContext(source,ctx);
  return window.DG_SURFACE_REVIEW_WORKER_ADAPTER.create({
    getWorker:()=>options.WorkerCtor||null,scriptUrl:()=>'/worker.js',timeoutMs:options.timeoutMs??90000,
    addTimer:options.addTimer||setTimeout,removeTimer:options.removeTimer||clearTimeout
  });
}

test('review worker resolves null when workers are unavailable or fail to construct',async()=>{
  assert.equal(await setup().run({job:'merge'}),null);
  class BrokenWorker{constructor(){throw Error('blocked');}}
  assert.equal(await setup({WorkerCtor:BrokenWorker}).run({job:'merge'}),null);
});

test('review worker returns results and terminates the worker',async()=>{
  let instance;
  class WorkerMock{constructor(url){this.url=url;this.terminated=false;instance=this;}postMessage(data){this.data=data;}terminate(){this.terminated=true;}}
  const worker=setup({WorkerCtor:WorkerMock});
  const pending=worker.run({job:'merge'});
  assert.equal(instance.url,'/worker.js');
  assert.deepEqual(instance.data,{job:'merge'});
  instance.onmessage({data:{features:[1]}});
  assert.deepEqual(await pending,{features:[1]});
  assert.equal(instance.terminated,true);
});

test('review worker fallback and worker errors retain their established outcomes',async()=>{
  let first;
  class ErrorWorker{constructor(){first=this;}postMessage(){}terminate(){}}
  const fallback=setup({WorkerCtor:ErrorWorker}).run({job:'grid'});
  first.onerror();
  assert.equal(await fallback,null);

  let second;
  class RejectWorker{constructor(){second=this;}postMessage(){}terminate(){}}
  const rejected=setup({WorkerCtor:RejectWorker}).run({job:'grid'});
  second.onmessage({data:{error:'geometry failed'}});
  await assert.rejects(rejected,/geometry failed/);
});

test('review worker cancellation and timeout reject the pending job',async()=>{
  let instance;
  class WorkerMock{constructor(){instance=this;}postMessage(){}terminate(){this.terminated=true;}}
  const worker=setup({WorkerCtor:WorkerMock});
  const pending=worker.run({job:'grid'});
  worker.cancelAll();
  await assert.rejects(pending,/Analiz kapatıldı/);
  assert.equal(instance.terminated,true);

  class TimeoutWorker{postMessage(){}terminate(){}}
  await assert.rejects(setup({WorkerCtor:TimeoutWorker,timeoutMs:1}).run({job:'grid'}),/zaman aşımına uğradı/);
});
