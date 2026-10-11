import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createReportQueueRunner} from '../scripts/lib/report-queue-runner.mjs';
import {createReportQueuePlanner} from '../scripts/lib/report-queue-planning.mjs';

function fixture({fetchError=false}={}) {
  const queue={entries:[{status:'Yayınlandı',report_id:'DGR-2026-0001',park_id:5}],processed_request_ids:['old'],production_started_at:'cutoff'};
  const calls=[];
  const planner=createReportQueuePlanner({isReportId:v=>/^DGR-\d{4}-\d{4}$/.test(v)});
  const run=createReportQueueRunner({RUN_LIMIT:3,QUEUE_PATH:'journal',...planner,
    loadQueue:()=>queue, saveQueue:q=>calls.push(['save',q.entries.length]),log:()=>{},
    fetchPending:async(...args)=>{calls.push(['fetch',...args]);if(fetchError)throw Object.assign(Error('offline'),{code:'OFFLINE'});return [{id:'new',park_id:5},{id:'bad',park_id:6}];},
    fetchPendingRetractions:async()=>({rows:[{id:'ret',report_id:'DGR-2026-0001',park_id:5}],missing:false}),
    handle:async req=>{calls.push(['publish',req.id]);return req.id==='bad'?{status:'Başarısız',message:'failure'}:{status:'Yayınlandı',report_id:'DGR-2026-0002',report_hash:'sha256:hash'};},
    handleRetraction:(req,pub)=>{calls.push(['retract',pub.report_id]);return {status:'Geri çekildi',report_id:req.report_id};}
  });
  return {run,queue,calls};
}

test('queue execution saves each result in order and reports mixed failures',async()=>{
  const f=fixture();
  const result=await f.run();
  assert.deepEqual(f.calls.slice(1),[['publish','new'],['save',2],['publish','bad'],['save',3],['retract','DGR-2026-0001'],['save',4]]);
  assert.deepEqual(f.calls[0],['fetch',50,['old'],'cutoff']);
  assert.equal(result.ok,false);
  assert.equal(result.processed,3);
  assert.equal(result.published,1);
  assert.equal(result.failed,1);
  assert.equal(result.retracted,1);
});

test('dry run plans both queues without executing or saving entries',async()=>{
  const f=fixture();
  const result=await f.run({dry:true});
  assert.equal(result.dry,true);
  assert.equal(result.processed,0);
  assert.equal(f.queue.entries.length,1);
  assert.deepEqual(f.calls.map(c=>c[0]),['fetch']);
});

test('publication queue fetch failure stops execution without writes',async()=>{
  const f=fixture({fetchError:true});
  const result=await f.run();
  assert.equal(result.reason,'OFFLINE');
  assert.equal(result.ok,false);
  assert.equal(result.processed,0);
  assert.deepEqual(f.calls.map(c=>c[0]),['fetch']);
});
