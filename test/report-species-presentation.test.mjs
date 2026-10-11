import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createReportSpeciesPresentation, grpTr} from '../scripts/lib/report-species-presentation.mjs';

const render=createReportSpeciesPresentation({
  esc:value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'),
  trNum:(value,d)=>Number(value).toFixed(d)
});

test('species presentation preserves row order, group colors, formatting and relative bar widths',()=>{
  const species=Object.freeze([
    Object.freeze({species:'<Pine>',grp:'IBRELI',share_pct:25,n:2,mean_dbh:12,mean_h:4,carbon_kg:30}),
    Object.freeze({species:'Oak',grp:'YAPRAKLI',share_pct:50,n:3,mean_dbh:20,mean_h:6,carbon_kg:60})
  ]);
  const {bars,spRows}=render(species);
  assert.match(bars,/&lt;Pine&gt;/);
  assert.doesNotMatch(bars,/<Pine>/);
  assert.match(bars,/width:50.0%;background:#2f9e44/);
  assert.match(bars,/width:100.0%;background:#e8590c/);
  assert.ok(bars.indexOf('Pine')<bars.indexOf('Oak'));
  assert.match(spRows,/<td>12.0<\/td><td>4.0<\/td><td>30.0<\/td><td>%25.0<\/td>/);
});

test('empty species and unknown groups retain existing presentation fallbacks',()=>{
  assert.deepEqual(render([]),{bars:'',spRows:''});
  assert.equal(grpTr('IBRELI'),'ibreli');
  assert.equal(grpTr('Custom'),'custom');
  const {bars}=render([{species:'Tree',grp:'Custom',share_pct:0}]);
  assert.match(bars,/width:0.0%;background:#8a928c/);
});
