#!/usr/bin/env node
/* Cross-language arithmetic check. Offline fixtures only; no production writes. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import vm from 'node:vm';
import {calcRow,loadRho,loadSpeciesDict} from './lib/mc.mjs';

const ROOT=fileURLToPath(new URL('..',import.meta.url));
const read=path=>readFileSync(resolve(ROOT,path),'utf8');
export function compareCarbonReference(referenceRows,fixture) {
  const context=vm.createContext({});context.window=context;
  for(const path of ['src/config/measurement-protocol-lock.js','src/config/wood-density-lock.js','src/config/species.js',
    'src/domain/trees/allometry.js','src/application/trees/calculate-tree-carbon.js','src/application/trees/calculate-tree-carbon-from-circumference.js'])vm.runInContext(read(path),context,{filename:path});
  const api=vm.runInContext(`DG_TREE_CIRCUMFERENCE_APPLICATION.createCircumferenceCarbonUseCase({
    diameterFromCircumference:diameterCmFromCircumference,
    calculateCarbon:DG_TREE_CARBON_APPLICATION.createTreeCarbonUseCase({calculateAllometry:DG_TREE_ALLOMETRY.calculate,resolveDensity:densityKgFor}).calculate
  })`,context);
  const policy=JSON.parse(read('research/carbon/density-policy-v1.json')),live=loadRho(),catalogue=loadSpeciesDict();
  assert.deepEqual(policy.defaults_kg_m3,live.grho,'Group densities changed');
  assert.deepEqual(policy.species_kg_m3,live.rho,'Specific densities changed');
  assert.deepEqual(policy.species_groups,live.groupBySpecies,'Species/groups changed');
  assert.equal(policy.lock_fingerprint,live.lockFingerprint);
  assert.equal(Object.keys(catalogue.byName).length,49);
  assert.equal(referenceRows.length,fixture.rows.length);
  let comparisons=0,maxRelativeError=0;
  const fields=['dbh_cm','density_kg_m3','agb','bhb','bio','c_agb','c_bhb','total_carbon','vol'];
  function close(actual,expected,label) {
    assert.ok(Number.isFinite(actual)&&Number.isFinite(expected),label+' non-finite');
    const relative=Math.abs(actual-expected)/Math.max(1,Math.abs(expected));
    maxRelativeError=Math.max(maxRelativeError,relative);
    assert.ok(relative<=1e-12,`${label}: ${actual} != ${expected}`);comparisons++;
  }
  for(let i=0;i<fixture.rows.length;i++) {
    const row=fixture.rows[i],reference=referenceRows[i],frozen=fixture.expected[i];
    const browser=api.calculate({circumferenceCm:row.girth_cm,heightM:row.height_m,species:row.species,group:row.grp});
    assert.equal(browser.valid,true,row.id);
    const report=calcRow(row.girth_cm/Math.PI,row.height_m,row.species,row.grp);
    assert.equal(report.valid,true,row.id);
    for(const field of fields) {
      close(reference[field],frozen[field],`${row.id} Python/frozen ${field}`);
      close(browser[field],reference[field],`${row.id} browser/Python ${field}`);
      if(field!=='dbh_cm')close(report[field],reference[field],`${row.id} report/Python ${field}`);
    }
    assert.equal(reference.density_source,frozen.density_source);
  }
  return {schema:'dendrogeo-carbon-reference-check/1',cases:fixture.rows.length,species:49,
    comparisons,maxRelativeError,tolerance:1e-12,productionFilesModified:false,
    scope:'Synthetic arithmetic/unit/density-policy regression; not local field validation'};
}

export function runReferenceCheck(python=process.env.DG_PYTHON||'python') {
  const fixture=JSON.parse(read('test/fixtures/carbon-reference-v1.json'));
  const result=spawnSync(python,[resolve(ROOT,'research/carbon/reference.py')],{
    input:JSON.stringify({rows:fixture.rows}),encoding:'utf8',maxBuffer:8*1024*1024,
    env:{...process.env,PYTHONDONTWRITEBYTECODE:'1',PYTHONIOENCODING:'utf-8'},
  });
  if(result.error)throw Error('Python reference could not run; set DG_PYTHON to an installed Python 3 executable: '+result.error.message);
  if(result.status!==0)throw Error('Python reference failed: '+result.stderr);
  return compareCarbonReference(JSON.parse(result.stdout).rows,fixture);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(runReferenceCheck(),null,2));
}
