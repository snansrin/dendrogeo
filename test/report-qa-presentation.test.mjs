import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createReportQaPresentation} from '../scripts/lib/report-qa-presentation.mjs';
import {qaStateOf, QA_STATE} from '../scripts/lib/mc.mjs';

const create=()=>createReportQaPresentation({qaStateOf,QA_STATE});

test('valid and information rows retain valid badge and existing HTML classes',()=>{
  const qa=create();
  assert.equal(qa.row('Check',true,'Detail'),'<tr><td class="tr">Check</td><td class="qok qst">✓ Geçerli</td><td class="qd">Detail</td></tr>');
  assert.match(qa.row('Source','ℹ Beyan','<code>source</code>'),/class="qinfo qst"/);
  assert.deepEqual(qa.summary(),{QA_ST:QA_STATE.VALID,QA_ST_LABEL:'🟢 GEÇERLİ',QA_ST_CLASS:'st st-ok',QA_BLOCKED:false,QA_REVIEW:false,qaStates:['ok','info']});
});

test('review and blocking rows use existing state precedence',()=>{
  const qa=create();
  assert.match(qa.row('Check',false,'Missing'),/class="qwarn qst">⚠ Kontrol edilemedi/);
  assert.equal(qa.summary().QA_ST,QA_STATE.REVIEW);
  assert.match(qa.row('Integrity','⛔ Blok','Mismatch'),/class="qbad qst"/);
  assert.equal(qa.summary().QA_ST,QA_STATE.BLOCKED);
  assert.equal(qa.summary().QA_BLOCKED,true);
});

test('row state is isolated between reports and unknown status remains review',()=>{
  const first=create(),second=create();
  first.row('Check','Unknown','Detail');
  assert.equal(first.summary().QA_ST,QA_STATE.REVIEW);
  second.row('Check',true,'Detail');
  assert.equal(second.summary().QA_ST,QA_STATE.VALID);
});
