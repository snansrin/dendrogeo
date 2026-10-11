import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createReportQueuePlanner} from '../scripts/lib/report-queue-planning.mjs';

const planner = createReportQueuePlanner({isReportId: value => /^DGR-\d{4}-\d{4}$/.test(value)});

test('publication planning preserves immutable inputs and successful retries stay processed', () => {
  const entries = Object.freeze([
    Object.freeze({request_id:'retry', status:'Başarısız'}),
    Object.freeze({request_id:'done', status:'Başarısız'}),
    Object.freeze({request_id:'done', status:'Yayınlandı'}),
    ...Array.from({length:3}, () => Object.freeze({request_id:'exhausted', status:'Başarısız'}))
  ]);
  const requests = Object.freeze(['done','retry','exhausted','archived','new'].map(id => Object.freeze({id})));
  assert.deepEqual(planner.planQueue(entries, requests, 1, ['done','retry','exhausted','archived']), {
    todo:[requests[1]], skipped:1, already:3
  });
});

test('retraction planning uses supplied report validation and latest publication park match', () => {
  const calls = [];
  const custom = createReportQueuePlanner({isReportId: value => {calls.push(value); return value === 'custom-report';}});
  const entries = [
    {status:'Yayınlandı', report_id:'custom-report', park_id:4},
    {status:'Yayınlandı', report_id:'custom-report', park_id:5}
  ];
  const wrong = {id:'wrong', report_id:'custom-report', park_id:4};
  const valid = {id:'valid', report_id:'custom-report', park_id:'5'};
  const malformed = {id:'malformed', report_id:'bad', park_id:5};
  assert.deepEqual(custom.planRetractions(entries, [wrong,valid,malformed]), {
    todo:[valid], skipped:0, invalid:[wrong,malformed]
  });
  assert.ok(calls.includes('bad'));
});

test('a retracted report cannot be scheduled by another retraction request', () => {
  const report_id = 'DGR-2026-0001';
  const entries = [{status:'Yayınlandı',report_id,park_id:5}, {status:'Geri çekildi',report_id,retraction_id:'old'}];
  assert.deepEqual(planner.planRetractions(entries, [{id:'new',report_id,park_id:5}]), {
    todo:[], skipped:0, invalid:[]
  });
});
