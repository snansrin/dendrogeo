import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createReportQaExplanation} from '../scripts/lib/report-qa-explanation.mjs';
import {QA_LIMITS} from '../scripts/lib/mc.mjs';

const explain=createReportQaExplanation({QA_LIMITS});
const clean=Object.freeze({n:3,dbh_fail:[],hd_fail:[],h_fail:[],dev_fail:[],n_unknown:0});
const base={INV:clean,G:{n_with_acc:3},snap:{geofence:{outside_rows:0}},nPhoto:3,NR:3};

test('missing supporting evidence does not mark clean measurement values as suspect',()=>{
  assert.deepEqual(explain(base),{AGAC_DEGER_TEMIZ:true,QA_WHY:''});
  const result=explain({...base,G:{},nPhoto:1,snap:{geofence:{outside_rows:1}}});
  assert.equal(result.AGAC_DEGER_TEMIZ,true);
  assert.equal(result.QA_WHY,'GNSS alıcı doğruluğu (accuracy_m) kaydedilmemiş; 1 kayıt poligon dışında; 2 kayıtta fotoğraf kanıtı eksik');
  assert.equal(explain({...base,INV:null}).AGAC_DEGER_TEMIZ,true);
});

test('measurement review reasons retain counts, threshold and existing order',()=>{
  const INV=Object.freeze({...clean,dbh_fail:[1],hd_fail:[2],hd_review:true,dev_fail:[3],species_review:true,n_unknown:2});
  const result=explain({...base,INV});
  assert.equal(result.AGAC_DEGER_TEMIZ,false);
  assert.equal(result.QA_WHY,`DBH geçerlilik kontrolünde 1/3 kayıt; gövde formu (boy/çap) incelemesinde 1/3 kayıt fiziksel makullük bandı dışında veya stand içi aykırı; karbon yeniden hesabında 1/3 kayıt ±%${QA_LIMITS.CARBON_DEV_PCT} bandı dışında; 2 tür kanonik sözlük dışında`);
  assert.equal(explain({...base,INV:{...clean,h_fail:[1]}}).AGAC_DEGER_TEMIZ,false);
});
