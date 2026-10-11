import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createReportQueueApplication} from '../scripts/lib/report-queue-application.mjs';
import {createReportQueuePlanner} from '../scripts/lib/report-queue-planning.mjs';

test('composition is lazy and wires publication through the runner to journal storage',async()=>{
  const calls=[];
  const application=createReportQueueApplication({
    root:'fixture',files:{},
    reports:{DGR_ID_RE:/^DGR-\d{4}-\d{4}$/,publishPark:async()=>{calls.push('publish');return {id:'DGR-2026-0001',hash:'digest'};}},
    publicationOptions:()=>({skipLulc:true}),measureArchive:async()=>123,
    store:{RUN_LIMIT:3,QUEUE_PATH:'journal',loadQueue:()=>({entries:[]}),saveQueue:()=>calls.push('save')},
    planner:createReportQueuePlanner({isReportId:v=>/^DGR-\d{4}-\d{4}$/.test(v)}),
    readers:{fetchPending:async()=>[{id:'req',park_id:5}],fetchPendingRetractions:async()=>({rows:[],missing:false})},
    log:()=>{}
  });
  assert.deepEqual(calls,[]);
  const result=await application.runQueue();
  assert.deepEqual(calls,['publish','save']);
  assert.equal(result.published,1);
  assert.equal(result.entries[0].archive_bytes,123);
  assert.equal(typeof application.applyAcceptedSurfaceSnapshot,'function');
  assert.equal(typeof application.handleRetraction,'function');
});
