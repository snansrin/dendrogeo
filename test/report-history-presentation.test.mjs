import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createReportHistoryPresentation} from '../scripts/lib/report-history-presentation.mjs';

const esc=v=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const render=createReportHistoryPresentation({esc});
const snap=Object.freeze({generated_at:'2026-10-11T12:00:00Z'});

test('missing history still renders the current report with publication date and emphasis',()=>{
  const html=render({M:{},snap,id:'DGR-2026-0042'});
  assert.equal((html.match(/<tr/g)||[]).length,1);
  assert.match(html,/<tr style="font-weight:700"/);
  assert.match(html,/2026-10-11/);
  assert.match(html,/İlk yayımlama \(bu rapor · geçerli sürüm\)/);
});

test('history preserves order and fallbacks, escapes values and leaves stored entries intact',()=>{
  const entry=Object.freeze({id:'<old>',note:'<note>',cur:true});
  const history=Object.freeze([entry,Object.freeze({id:'older',date:'2026-10-01'})]);
  const html=render({M:{history},snap,id:'current'});
  assert.ok(html.indexOf('&lt;old&gt;')<html.indexOf('older'));
  assert.ok(html.indexOf('older')<html.indexOf('current'));
  assert.match(html,/<td>—<\/td>/);
  assert.match(html,/&lt;note&gt;/);
  assert.equal((html.match(/font-weight:700/g)||[]).length,1);
  assert.equal(entry.cur,true);
  assert.equal(history.length,2);
});
