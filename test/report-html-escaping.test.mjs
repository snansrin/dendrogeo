import {test} from 'node:test';
import assert from 'node:assert/strict';
import {escapeReportHtml} from '../scripts/lib/report-html-escaping.mjs';

test('report HTML escaping preserves the existing text interpolation contract',()=>{
  assert.equal(escapeReportHtml('& < > "quoted"'), '&amp; &lt; &gt; &quot;quoted&quot;');
  assert.equal(escapeReportHtml(null), '');
  assert.equal(escapeReportHtml(undefined), '');
  assert.equal(escapeReportHtml(0), '0');
  assert.equal(escapeReportHtml("O'Brien"), "O'Brien");
});
