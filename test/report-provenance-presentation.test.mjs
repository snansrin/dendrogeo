import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createReportProvenancePresentation} from '../scripts/lib/report-provenance-presentation.mjs';

const render=createReportProvenancePresentation({esc:v=>String(v).replaceAll('<','&lt;')});
const base={engine:'<Engine',engineVer:null,appVer:null,dataset:'<Dataset',resolutionLabel:'10 m',P:{id:3},git:null,L:null,dataYear:2021,id:'DGR-2026-0042',epsg:null,snap:{generated_at:'2026-10-11T00:00:00Z'},hash:'1234567890abcdef',doi:null};

test('missing provenance is disclosed and raster reproduction retains version caveat',()=>{
  const html=render(base);
  assert.match(html,/&lt;Engine/);
  assert.match(html,/&lt;Dataset/);
  assert.match(html,/git commit kaydı bu kopyada yok/);
  assert.match(html,/node scripts\/make-report.mjs --park 3/);
  assert.match(html,/aynı komut farklı sonuç üretebilir/);
  assert.match(html,/v200, 2021/);
  assert.match(html,/<b>Projection<\/b><code>—/);
  assert.match(html,/<code>atanmadı<\/code>/);
  assert.match(html,/sha256:1234567890abcdef/);
});

test('reviewed archive instructions, versions, DOI and commit fingerprint remain explicit',()=>{
  const html=render({...base,engineVer:'4.2',appVer:'3.0',git:'abcdef123456',L:{review:{}},epsg:'EPSG:32636',doi:'10.1234/example'});
  assert.match(html,/uygulama 3.0/);
  assert.match(html,/<code>abcdef1<\/code>/);
  assert.doesNotMatch(html,/abcdef123456|node scripts\/make-report/);
  assert.match(html,/surface.geojson/);
  assert.match(html,/tekrar analiz için bu arşiv girdileri kullanılmalıdır/);
  assert.match(html,/EPSG:32636/);
  assert.match(html,/href="https:\/\/doi.org\/10.1234\/example"/);
});
