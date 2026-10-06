import {test,describe} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {loadApp} from '../scripts/test-harness.mjs';

const app=loadApp({sadece:[
  'src/config/measurement-protocol-lock.js',
  'src/config/wood-density-lock.js',
  'src/config/species.js',
  'src/services/allometry.js'
]});

describe('FINAL saha ölçüm protokolü kilidi',()=>{
 test('kimlik, payload ve SHA-256 parmak izi değişmez',()=>{
  const lock=app.DG_MEASUREMENT_PROTOCOL_LOCK;
  assert.equal(lock.id,'DG-MEASURE-LOCK-2026-10-06-FINAL');
  assert.equal(lock.fingerprint,'4e48cf360622b5633e664618a8626756b3207cec8dd63a3158714e957eae3212');
  assert.equal(Object.isFrozen(lock),true);
  assert.equal(Object.isFrozen(lock.payload),true);
  assert.equal(lock.payload.raw_field,'measurements.girth_cm');
  assert.equal(lock.payload.raw_semantic,'circumference_cm_at_1_30_m');
  assert.equal(lock.payload.derived_field,'measurements.dbh_cm');
  assert.equal(lock.payload.derived_semantic,'diameter_cm');
  assert.equal(lock.payload.diameter_conversion,'diameter_cm=circumference_cm/pi');
  assert.equal(lock.payload.allometry_input,'derived_diameter_cm');
  const hex=createHash('sha256').update(JSON.stringify(lock.payload)).digest('hex');
  assert.equal(hex,lock.fingerprint);
 });
 test('çevre/π ve ters dönüşüm sayısal olarak birebir',()=>{
  const c=57,d=app.diameterCmFromCircumference(c);
  assert.ok(Math.abs(d-18.14366351247607)<1e-12);
  assert.ok(Math.abs(app.circumferenceCmFromDiameter(d)-c)<1e-12);
  assert.equal(app.circumferenceIsValid(57),true);
  assert.equal(app.circumferenceIsValid(0),false);
  assert.equal(app.circumferenceIsValid(400*Math.PI+1),false);
 });
});

describe('allometri giriş sınırı: çevre ham, DBH türetilmiş',()=>{
 test('calc() yalnız gerçek DBH çapı ile çalışan çekirdek olarak kalır',()=>{
  const r=app.calc(57,7.5,'SIĞLA','YAPRAKLI');
  assert.ok(Math.abs(r.total_carbon-418.41910806687343)<1e-9);
  assert.equal(r.dbh_cm,57);
 });
 test('saha yolu 57 cm çevreyi önce πye böler: Sığla 44,789370 kg C',()=>{
  const r=app.calcFromCircumference(57,7.5,'SIĞLA','YAPRAKLI');
  assert.equal(r.valid,true);
  assert.equal(r.density_kg_m3,541);
  assert.equal(r.circumference_cm,57);
  assert.ok(Math.abs(r.dbh_cm-18.14366351247607)<1e-12);
  assert.ok(Math.abs(r.total_carbon-44.78937042214552)<1e-9);
  assert.ok(Math.abs(r.vol-0.09695520189479401)<1e-12);
  assert.ok(Math.abs(r.total_carbon-418.41910806687343)>300,'ham çevre doğrudan çap gibi kullanılmış olamaz');
 });
});
