import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createReportMethodPresentation} from '../scripts/lib/report-method-presentation.mjs';

const esc=value=>String(value).replaceAll('<','&lt;').replaceAll('>','&gt;');
const render=createReportMethodPresentation({esc,trNum:(v,d)=>Number(v).toFixed(d),fmtDateTr:String});
const base={snap:{rows:[{height_m:8.1},{height_m:8.123}]},G:{},NR:2,nPhoto:1,L:null,dataset:'Raster <source>',epsg:'EPSG:32636',deltaPct:0.1};

test('method statements preserve missing GNSS disclosure and partial photo evidence',()=>{
  const result=render(base);
  assert.equal(result.hbRows,1);
  assert.match(result.dbhcTxt,/DBH = çevre \/ π/);
  assert.match(result.gnssTxt,/sayısal olarak beyan edilememektedir/);
  assert.doesNotMatch(result.gnssTxt,/±0/);
  assert.equal(result.photoTxt,'kısmen sağlanmıştır (1/2 kayıt)');
  assert.equal(result.lulcMethod,'');
  const recorded=render({...base,G:{n_with_acc:1,n:2,mean_acc_m:4.2},nPhoto:2});
  assert.match(recorded.gnssTxt,/1\/2 kayıt · ortalama ±4.2 m/);
  assert.match(recorded.photoTxt,/tüm kayıtlarda sağlanmıştır/);
});

test('accepted, reviewed and raster methods retain their distinct source disclosures',()=>{
  const accepted=render({...base,L:Object.freeze({accepted:true,accepted_at:'2026-10-11'})}).lulcMethod;
  assert.match(accepted,/uydu analizi yeniden çalıştırılmamıştır/);
  assert.match(accepted,/Eski kayıt ayrıntılı geometri taşımadığından/);
  const reviewed=render({...base,L:{review:{acceptedAt:'2026-10-11'}}}).lulcMethod;
  assert.match(reviewed,/aynı kayıtlı geometriden gelir/);
  assert.match(reviewed,/bağımsız saha doğrulaması sayılmaz/);
  const raster=render({...base,L:{masked_ha:1.2}}).lulcMethod;
  assert.match(raster,/Raster &lt;source&gt;/);
  assert.match(raster,/EPSG:32636/);
  assert.match(raster,/1.20 ha/);
  assert.match(raster,/%0,5 eşiğini aşarsa sonuç YAYINLANMAZ/);
  assert.match(raster,/%0.100/);
});
