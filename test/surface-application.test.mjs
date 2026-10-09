import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadApp} from '../scripts/test-harness.mjs';

const app=loadApp({sadece:['src/domain/surface/quality-gates.js','src/contracts/surface-analysis.js','src/application/surface/run-analysis.js']});

function makeUseCase(overrides={}){
  const calls=[];
  const sources={primary:{key:'worldcover',year:2021,label:'ESA',citation:'ESA'},cross:{year:2020}};
  const result={assignedAreaM2:100,classifiedAreaM2:100,maskedAreaM2:0,sourceCells:1,
    groupCounts:{green:1},groupAreas:{green:100},rawCounts:{10:1},rawAreas:{10:100},cells:[]};
  const deps={
    ensureRaster:async()=>calls.push('ensure'),hasRaster:()=>true,getSources:()=>sources,
    getPixelSize:()=>10,getBbox:()=>({minLon:0}),analyzeSource:async source=>{calls.push(source.key);return{result,items:['tile-1']};},
    detectPatches:()=>[],getClasses:()=>[{key:'green',label:'Yeşil',emoji:'🌿',color:'#0f0'}],
    assertCoverage:app.DG_SURFACE_QUALITY.assertCoverage,...overrides
  };
  return{useCase:app.DG_SURFACE_APPLICATION.createRunSurfaceAnalysis(deps),calls,result};
}

test('invalid park input stops before raster loading or source access',async()=>{
  const {useCase,calls}=makeUseCase();
  await assert.rejects(useCase.run({outer:[],parkAreaM2:100}),/park polygonu/);
  assert.deepEqual(calls,[]);
});

test('single run uses the primary source and returns a detached result DTO',async()=>{
  const {useCase,calls,result}=makeUseCase();
  const output=await useCase.run({outer:[[[39,32],[39,33],[40,33]]],holes:[],parkAreaM2:100});
  assert.deepEqual(calls,['ensure','worldcover']);
  assert.equal(output.report.classes.green.areaM2,100);
  assert.equal(output.report.crossCitation,null);
  assert.equal(output.report.areaDeltaPct,0);
  assert.equal(output.result,result);
});

test('quality gate failure rejects the run without forcing another class',async()=>{
  const {useCase,calls}=makeUseCase({
    analyzeSource:async source=>{calls.push(source.key);return{result:{assignedAreaM2:50,cells:[]},items:[]};}
  });
  await assert.rejects(useCase.run({outer:[[[39,32],[39,33],[40,33]]],parkAreaM2:100}),/Raster\/park alanı QA başarısız/);
  assert.deepEqual(calls,['ensure','worldcover']);
});

test('surface coverage gate rejects empty coverage and reports measured mismatch',()=>{
  assert.throws(()=>app.DG_SURFACE_QUALITY.assertCoverage(0,100),/kesişmiyor/);
  assert.throws(()=>app.DG_SURFACE_QUALITY.assertCoverage(90,100),/10\.00% fark/);
  assert.equal(app.DG_SURFACE_QUALITY.assertCoverage(99.5,100),0.5);
});
