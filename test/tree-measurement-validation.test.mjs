import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadApp} from '../scripts/test-harness.mjs';

const app=loadApp({sadece:['src/application/trees/validate-measurement.js']});
const valid={projectId:4,pointId:2,measurementNo:1,group:'YAPRAKLI',species:'IHLAMUR',circumferenceCm:52,heightM:7.2};

test('tree measurement validator requires injected scientific constraints',()=>{
  assert.throws(()=>app.DG_TREE_MEASUREMENT_APPLICATION.createTreeMeasurementValidator({}),/bağımlılıkları gereklidir/);
});

test('new measurement checks identifiers first, then locked biological constraints',()=>{
  const calls=[];
  const validator=app.DG_TREE_MEASUREMENT_APPLICATION.createTreeMeasurementValidator({
    measurementGroups:['İBRELİ','YAPRAKLI'],
    resolveDensity:(species,group)=>{calls.push(['density',species,group]);return 541;},
    isCircumferenceValid:circumference=>{calls.push(['protocol',circumference]);return circumference>0&&circumference<=1256;}
  });
  assert.deepEqual(JSON.parse(JSON.stringify(validator.validateNewMeasurement({...valid,pointId:0}))),{valid:false,reason:'POINT_ID_INVALID'});
  assert.equal(calls.length,0,'identifier errors must not call scientific ports');
  assert.deepEqual(JSON.parse(JSON.stringify(validator.validateNewMeasurement(valid))),{valid:true,reason:null});
  assert.deepEqual(calls.map(call=>call[0]),['density','protocol']);
});

test('biometric validation preserves reason precedence and defers constraints',()=>{
  const calls=[];
  const validator=app.DG_TREE_MEASUREMENT_APPLICATION.createTreeMeasurementValidator({
    measurementGroups:['İBRELİ','YAPRAKLI'],
    resolveDensity:()=>{calls.push('density');return null;},
    isCircumferenceValid:()=>{calls.push('protocol');return false;}
  });
  const invalid=validator.validateBiometrics({...valid,group:'UNKNOWN'});
  assert.equal(invalid.reason,'GROUP_UNSUPPORTED');
  assert.deepEqual(calls,[]);
  assert.equal(validator.validateBiometrics({...valid,species:'UNKNOWN'}).reason,'DENSITY_MISSING');
  assert.deepEqual(calls,['density']);
});
