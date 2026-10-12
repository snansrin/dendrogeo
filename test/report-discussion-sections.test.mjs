import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderReportDiscussionSections} from '../scripts/lib/report-discussion-sections.mjs';

test('discussion sections preserve headings, order, markup and presenter inputs',()=>{
  const calls=[];
  const input={
    snap:{id:'snapshot'},L:{source:'reviewed'},t:{n:7},ciTxt:'1.20 t [GA]',
    knotted:true,knotN:2,G:{samples:5},INV:{species:1},HD:12,DB:18,
    govdeAralikTxt:'range',tN:7,
    renderEvaluationPresentation:value=>{calls.push(['evaluation',value]);return '<p>evaluation</p>';},
    renderLimitationsPresentation:value=>{calls.push(['limitations',value]);return '<li>limitation</li>';},
  };
  const html=renderReportDiscussionSections(input);
  assert.equal(html,'<h2><span class="no">8</span>Değerlendirme</h2>\n<p>evaluation</p>\n\n<h2><span class="no">9</span>Sınırlılıklar</h2>\n<ul class="lim">\n <li>limitation</li>\n</ul>');
  assert.deepEqual(calls.map(([name])=>name),['evaluation','limitations']);
  assert.deepEqual(calls[0][1],{snap:input.snap,L:input.L,t:input.t,ciTxt:input.ciTxt});
  assert.deepEqual(calls[1][1],{
    L:input.L,knotted:input.knotted,knotN:input.knotN,t:input.t,G:input.G,
    INV:input.INV,HD:input.HD,DB:input.DB,govdeAralikTxt:input.govdeAralikTxt,tN:input.tN,
  });
});
