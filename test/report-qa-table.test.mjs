import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createReportQaTable} from '../scripts/lib/report-qa-table.mjs';
import {createReportQaPresentation} from '../scripts/lib/report-qa-presentation.mjs';
import {QA_LIMITS,DBH_REASON_TR,QA_STATE,qaStateOf} from '../scripts/lib/mc.mjs';

const render=createReportQaTable({esc:v=>String(v).replaceAll('<','&lt;'),trNum:(v,d)=>Number(v).toFixed(d),QA_LIMITS,DBH_REASON_TR});
const base={P:{osm_key:'way/1',area_m2:10000},GQ:null,knotted:false,knotN:0,L:null,parkHa:1,covHa:null,deltaPct:null,dataset:'Raster',dataYear:2021,resolutionLabel:'10 m',INV:null,nPhoto:2,NR:2,G:{n_with_acc:2,n:2,mean_acc_m:3},hdDetail:'height detail',devDetail:'carbon detail',snap:{geofence:{verified_rows:2,total:2,outside_rows:0},moderation:{approved:2,reviewed:2}},hash:'1234567890abcdef1234'};
function run(input){const collector=createReportQaPresentation({qaStateOf,QA_STATE});const html=render({...base,...input,qaRow:collector.row});return {html,...collector.summary()};}

test('optional checks are omitted and summary comes from the rendered rows',()=>{
  const valid=run({});
  assert.equal((valid.html.match(/<tr>/g)||[]).length,6);
  assert.equal(valid.QA_ST,QA_STATE.VALID);
  assert.doesNotMatch(valid.html,/Raster kapsama|Tür\/grup kilidi/);
  const review=run({nPhoto:1,G:{}});
  assert.equal(review.QA_ST,QA_STATE.REVIEW);
  assert.match(review.html,/1\/2 kayıt sahada/);
  assert.match(review.html,/SAYIYLA beyan edilemiyor/);
});

test('surface threshold, inventory blocks and source escaping remain intact',()=>{
  const INV={n:2,n_rows:2,n_unknown:0,unknown:[],group_fail:[],dbh_fail:[{point_id:1,reason:'unknown'}],dbh_block:true,hd_review:false,dev_fail:[],dev_block:false};
  const result=run({INV,L:{cells:2,source:'<source',classes:[1]},covHa:1,deltaPct:0.5,GQ:{source:'<source',self_intersections:0}});
  assert.equal(result.QA_BLOCKED,true);
  assert.match(result.html,/&lt;source/);
  assert.match(result.html,/Boy\/DBH oranı incelemesi/);
  assert.match(result.html,/height detail/);
  assert.match(result.html,/carbon detail/);
  assert.equal(run({L:{cells:2,source:'Raster',classes:[1]},covHa:1,deltaPct:0.5}).QA_ST,QA_STATE.VALID);
  assert.equal(run({L:{cells:2,source:'Raster',classes:[1]},covHa:1,deltaPct:0.501}).QA_ST,QA_STATE.REVIEW);
});
