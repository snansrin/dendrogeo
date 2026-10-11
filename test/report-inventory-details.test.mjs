import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createReportInventoryDetails} from '../scripts/lib/report-inventory-details.mjs';
import {QA_LIMITS} from '../scripts/lib/mc.mjs';

const render=createReportInventoryDetails({trNum:(v,d)=>Number(v).toFixed(d),QA_LIMITS});
const base={n:3,hd_fail:[],h_fail:[],hd_band_out:[],dev_fail:[]};

test('missing inventory values remain unavailable rather than zero',()=>{
  const result=render(null);
  assert.equal(result.hdDetail,null);
  assert.equal(result.devDetail,null);
  assert.equal(result.govdeAralikTxt,null);
  for(const value of [null,undefined,NaN,Infinity])assert.equal(result.tN(value),'—');
  assert.equal(result.tN(0),'0.0');
});

test('typical-band disclosure stays informational while carbon sources remain explicit',()=>{
  const result=render(Object.freeze({...base,dbh_stats:{min:10,max:40,medyan:20,n:3},hd_band_out:[1],dev_rho:{n:3,tur:2,grup:1}}));
  assert.equal(result.govdeAralikTxt,'10.0–40.0 cm (medyan 20.0 cm, n=3)');
  assert.match(result.hdDetail,/UYARI DEĞİL, BİLGİDİR/);
  assert.match(result.devDetail,/2 kayıt kilitli tür ρ satırı/);
  assert.match(result.devDetail,/1 kayıt yalnız kendi grup genelini/);
});

test('review and systemic block descriptions preserve findings and bounded point lists',()=>{
  const review=render({...base,hd_review:true,hd_fail:[{point_id:7,hd:3,z:4,reason:'stand-aykiri'}],h_fail:Array.from({length:14},(_,i)=>({point_id:i+1})),dev_fail:[{point_id:8,stored:100,expected:50,dev_pct:100}]});
  assert.match(review.hdDetail,/P7: h\/D 3.00, z 4.00/);
  assert.match(review.hdDetail,/yayını bloklamaz/);
  assert.match(review.hdDetail,/P12 … \(\+2 kayıt\)/);
  assert.doesNotMatch(review.hdDetail,/P13/);
  assert.match(review.devDetail,/P8: saklı 100.0 kg ↔ beklenen 50.0 kg/);
  const blocked=render({...base,dev_block:true,dev_fail:[1]}).devDetail;
  assert.match(blocked,/1\/3 kayıtta saklı karbon/);
  assert.match(blocked,/SİSTEMİK hesap bütünlüğü sorunu/);
});
