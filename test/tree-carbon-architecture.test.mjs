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
