import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/contracts/surface-analysis.js',import.meta.url),'utf8');
const context=vm.createContext({window:{},Number,Object,Array,String,TypeError,Error});
vm.runInContext(source,context);
const contracts=context.window.DG_SURFACE_CONTRACTS;
const result=()=>({assignedAreaM2:100,classifiedAreaM2:90,maskedAreaM2:10,sourceCells:1,
  groupCounts:{green:1},groupAreas:{green:90},rawCounts:{10:1},rawAreas:{10:100},cells:[]});

test('AnalysisResult requires finite nonnegative areas and count maps',()=>{
  assert.equal(contracts.assertAnalysisResult(result()).assignedAreaM2,100);
  assert.throws(()=>contracts.assertAnalysisResult({...result(),assignedAreaM2:NaN}),/assignedAreaM2/);
  assert.throws(()=>contracts.assertAnalysisResult({...result(),groupCounts:{green:-1}}),/green/);
  assert.throws(()=>contracts.assertAnalysisResult({...result(),classifiedAreaM2:101}),/atanan alanı aşamaz/);
});

test('SurfaceCell checks the raster-grid and WGS84 geometry shape',()=>{
  const cell={row:4,col:7,epsg:32636,classCode:10,classKey:'green',source:'worldcover',areaM2:90,
    center:{lat:39,lon:32},quadWgs:[[32,39],[32.1,39],[32.1,39.1],[32,39.1]]};
  assert.equal(contracts.assertCell(cell),cell);
  assert.throws(()=>contracts.assertCell({...cell,quadWgs:[[32,39]]}),/dört/);
  assert.throws(()=>contracts.assertCell({...cell,areaM2:0}),/pozitif/);
});

test('source evidence, output, patch and versioned error DTOs are checked',()=>{
  const patch={classKey:'green',areaM2:50,cells:3,centroid:{lat:39,lon:32}};
  const output={report:{classes:{}},result:result(),crossResult:null,patches:[patch]};
  assert.equal(contracts.assertSourceEvidence({result:result(),items:['tile-1']}).items[0],'tile-1');
  assert.equal(contracts.assertAnalysisOutput(output),output);
  assert.throws(()=>contracts.assertAnalysisOutput({...output,patches:[{...patch,cells:0}]}),/pozitif tamsayı/);
  assert.deepEqual(JSON.parse(JSON.stringify(contracts.createAnalysisError(Error('timeout'),'TIMEOUT',true))),
    {version:1,code:'TIMEOUT',message:'timeout',retryable:true});
});
