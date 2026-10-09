import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadApp} from '../scripts/test-harness.mjs';

const app=loadApp({sadece:[
  'src/config/species.js',
  'src/services/allometry.js'
]});

test('tree carbon layers keep one formula and preserve the legacy service API',()=>{
  const domain=readFileSync(new URL('../src/domain/trees/allometry.js',import.meta.url),'utf8');
  const service=readFileSync(new URL('../src/services/allometry.js',import.meta.url),'utf8');
  assert.match(domain,/0\.0673.*0\.976/);
  assert.doesNotMatch(service,/0\.0673|0\.976|0\.26|0\.47/);
  const result=app.calc(57,7.5,'SIĞLA','YAPRAKLI');
  assert.equal(result.valid,true);
  assert.ok(Math.abs(result.total_carbon-418.41910806687343)<1e-9);
});

test('application use-case requires its domain and density ports',()=>{
  assert.throws(()=>app.DG_TREE_CARBON_APPLICATION.createTreeCarbonUseCase({}),/portları gereklidir/);
  const calls=[];
  const useCase=app.DG_TREE_CARBON_APPLICATION.createTreeCarbonUseCase({
    resolveDensity:(species,group)=>{calls.push(['density',species,group]);return 541;},
    calculateAllometry:input=>{calls.push(['domain',input]);return {valid:true};}
  });
  assert.deepEqual(JSON.parse(JSON.stringify(useCase.calculate({dbhCm:57,heightM:7.5,species:'SIĞLA',group:'YAPRAKLI'}))),{valid:true});
  assert.equal(calls[0][0],'density');
  assert.equal(calls[1][0],'domain');
  assert.equal(calls[1][1].densityKgM3,541);
});

test('circumference use-case delegates conversion and carbon in order',()=>{
  assert.throws(()=>app.DG_TREE_CIRCUMFERENCE_APPLICATION.createCircumferenceCarbonUseCase({}),/portları gereklidir/);
  const calls=[];
  const useCase=app.DG_TREE_CIRCUMFERENCE_APPLICATION.createCircumferenceCarbonUseCase({
    diameterFromCircumference:value=>{calls.push(['protocol',value]);return value/Math.PI;},
    calculateCarbon:input=>{calls.push(['carbon',input]);return {valid:true,total_carbon:4};}
  });
  const result=useCase.calculate({circumferenceCm:'52',heightM:7,species:'IHLAMUR',group:'YAPRAKLI'});
  assert.deepEqual(calls.map(call=>call[0]),['protocol','carbon']);
  assert.equal(calls[0][1],52);
  assert.ok(Math.abs(calls[1][1].dbhCm-52/Math.PI)<1e-12);
  assert.equal(result.circumference_cm,52);
});

test('legacy circumference API preserves the locked conversion and return shape',()=>{
  const fromCircumference=app.calcFromCircumference(52,7.5,'SIĞLA','YAPRAKLI');
  const fromDiameter=app.calc(52/Math.PI,7.5,'SIĞLA','YAPRAKLI');
  assert.equal(fromCircumference.valid,true);
  assert.equal(fromCircumference.circumference_cm,52);
  assert.equal(fromCircumference.total_carbon,fromDiameter.total_carbon);
  const invalid=app.calcFromCircumference('not-a-number',7.5,'SIĞLA','YAPRAKLI');
  assert.equal(invalid.valid,false);
  assert.equal(invalid.circumference_cm,null);
});
