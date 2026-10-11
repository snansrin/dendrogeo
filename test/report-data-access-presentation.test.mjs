import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderReportDataAccess} from '../scripts/lib/report-data-access-presentation.mjs';

test('base artifact links, print/share controls and reuse terms retain their contracts',()=>{
  const html=renderReportDataAccess({L:null,M:{}});
  for(const path of ['olcum.csv','park.geojson','data.json','metadata.json','../../'])assert.ok(html.includes(`href="${path}"`));
  assert.match(html,/onclick="window.print\(\)"/);
  assert.match(html,/id="dgShareBtn" onclick="dgShareReport\(\)"/);
  assert.match(html,/CC BY-NC 4.0/);
  assert.match(html,/§13 künyesine atıf zorunludur/);
  assert.doesNotMatch(html,/href="harita.png"|href="rapor.pdf"/);
});

test('map and published PDF links preserve independent existing conditions',()=>{
  assert.match(renderReportDataAccess({L:{},M:{}}),/href="harita.png"/);
  const pdf=renderReportDataAccess({L:null,M:Object.freeze({pdf_path:'archive/rapor.pdf'})});
  assert.match(pdf,/href="rapor.pdf"/);
  assert.doesNotMatch(pdf,/href="harita.png"|href="archive\/rapor.pdf"/);
  const both=renderReportDataAccess({L:{},M:{pdf_path:true}});
  assert.match(both,/href="harita.png"/);
  assert.match(both,/href="rapor.pdf"/);
});
