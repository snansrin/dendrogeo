import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {buildTreeDetectionPilot as build} from '../scripts/lib/tree-detection-pilot.mjs';
const metadata={width:1000,height:1000,imageId:'original-image',modelId:'tree-detection-fuytu/4'};
const options={confidence:.5,nmsIou:.7};
const row=(changes={})=>({x:100,y:100,width:40,height:50,confidence:.9,class:'Tree',...changes});
test('pilot suppresses same-object aliases but preserves separate crowns as candidates, with no invented measurements',()=>{
 const input={image:{width:1000,height:1000},predictions:[row(),row({class:'tree-top',confidence:.8}),row({x:300}),row({class:'unknown'}),row({confidence:.2})]};
 const before=JSON.stringify(input),result=build(input,metadata,options);
 assert.equal(result.candidateCount,2);assert.equal(result.confirmedTreeCount,null);assert.equal(result.counts.duplicates,1);assert.equal(result.counts.unknownLabels,1);assert.equal(result.counts.belowThreshold,1);
 assert.equal(result.candidates[0].crownAreaM2,null);assert.equal(result.candidates[0].crownDiameterM,null);assert.equal(result.candidates[0].species,null);assert.equal(JSON.stringify(input),before);
});
test('offline pilot CLI writes a new candidate file and refuses to overwrite it',()=>{
 const directory=mkdtempSync(join(tmpdir(),'dendrogeo-tree-pilot-')),predictionPath=join(directory,'predictions.json'),metadataPath=join(directory,'metadata.json'),outputPath=join(directory,'output.json');
 writeFileSync(predictionPath,JSON.stringify({predictions:[row()]}));writeFileSync(metadataPath,JSON.stringify({...metadata,...options}));
 const args=[fileURLToPath(new URL('../scripts/tree-detection-pilot.mjs',import.meta.url)),predictionPath,metadataPath,outputPath];
 execFileSync(process.execPath,args,{stdio:'pipe'});const saved=readFileSync(outputPath,'utf8'),result=JSON.parse(saved);
 assert.equal(result.candidateCount,1);assert.equal(result.confirmedTreeCount,null);
 assert.throws(()=>execFileSync(process.execPath,args,{stdio:'pipe'}));assert.equal(readFileSync(outputPath,'utf8'),saved);
});
test('image-edge candidates stay partial, off-image detections are excluded',()=>{
 const result=build({predictions:[row({x:1}),row({x:-100})]},metadata,options);
 assert.equal(result.candidateCount,1);assert.equal(result.candidates[0].partial,true);assert.equal(result.candidates[0].boxPixels[0],0);assert.equal(result.counts.outsideImage,1);
});
test('missing thresholds, unreviewed models, malformed data and resized predictions are rejected',()=>{
 assert.throws(()=>build({predictions:[row()]},metadata),/Explicit/);
 assert.throws(()=>build({predictions:[row({width:NaN})]},metadata,options),/Invalid prediction/);
 assert.throws(()=>build({predictions:[]},{...metadata,width:0},options),/dimensions/);
 assert.throws(()=>build({image:{width:640,height:640},predictions:[]},metadata,options),/resize/);
 assert.throws(()=>build({predictions:[]},metadata,{confidence:2,nmsIou:.7}),/Explicit/);
 assert.throws(()=>build({predictions:[]},{...metadata,modelId:'unreviewed/1'},options),/label mapping/);
});
