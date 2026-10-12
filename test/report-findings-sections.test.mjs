import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderReportFindingsSections} from '../scripts/lib/report-findings-sections.mjs';

test('findings composer preserves result/map headings, output order and presenter inputs',()=>{
  const calls=[];
  const results={ciTxt:'1.2 t',cells:[1,2]};
  const map={park:{id:7},epsg:'EPSG:4326'};
  const html=renderReportFindingsSections({
    renderResultsPresentation:value=>{calls.push(['results',value]);return '<section>results</section>';},
    results,
    renderMapPresentation:value=>{calls.push(['map',value]);return '<section>map</section>';},
    map,
  });
  assert.equal(html,'<h2><span class="no">5</span>Nicel Sonuçlar</h2>\n<section>results</section>\n<h2><span class="no">6</span>Harita</h2>\n<section>map</section>');
  assert.deepEqual(calls,[['results',results],['map',map]]);
});
