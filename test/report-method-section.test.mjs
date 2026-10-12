import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderReportMethodSection} from '../scripts/lib/report-method-section.mjs';

const renderMethodPresentation=()=>({
  dbhcTxt:'DBH statement',
  hbRows:1,
  gnssTxt:' GNSS statement',
  photoTxt:'photo statement',
  lulcMethod:'<p>Recorded land cover.</p>',
});
const base={
  snap:{mc:{N:100,SEED:7},moderation:{approved:2,reviewed:1}},
  G:{},NR:2,nPhoto:2,L:null,dataset:'dataset',epsg:null,deltaPct:null,
  parkHa:1,GJ:null,knotted:false,knotN:null,
  renderMethodPresentation,REPORT_DATA_DICTIONARY:'<p>Dictionary.</p>',
  esc:String,trNum:(value,digits)=>Number(value).toFixed(digits),
};

test('method section preserves section order, existing disclosures and the data dictionary',()=>{
  const html=renderReportMethodSection(base);
  assert.match(html,/^<h2><span class="no">4<\/span>Yöntem<\/h2>/);
  assert.match(html,/DBH statement Ağaç boyu sahada ölçülmüş/);
  assert.match(html,/n=100, sabit tohum=7/);
  assert.match(html,/<p>Recorded land cover\.<\/p>/);
  assert.match(html,/<p>Dictionary\.<\/p>$/);
  assert.match(html,/AGB = 0\.0673·\(ρ·D²·H\)\^0\.976/);
  assert.match(html,/DBH çapıdır<\/b>; ham çevre hiçbir aşamada doğrudan D olarak kullanılmaz/);
});

test('missing land-cover method retains boundary and raster disclosure behavior',()=>{
  const html=renderReportMethodSection({
    ...base,
    snap:{...base.snap,lulc:{error:'<technical>'}},
    GJ:{ring_points:4,ring_area_m2:250000},
    knotted:true,knotN:2,
    renderMethodPresentation:()=>({dbhcTxt:'',hbRows:0,gnssTxt:'',photoTxt:'',lulcMethod:''}),
  });
  assert.match(html,/teknik not: &lt;technical&gt;/);
  assert.match(html,/2 kendini kesen segment çifti/);
  assert.match(html,/4 nokta; jeodezik alanı 25\.00 ha/);
  assert.match(html,/künye alanından \(1\.00 ha\)/);
  assert.match(html,/4\.5 Doğrulama zinciri/);
});
