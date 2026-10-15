import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/domain/surface/classify-effective-surface-cell.js',import.meta.url),'utf8');
function classify(input){
  const window={};vm.runInNewContext(source,{window});
  return window.DG_CLASSIFY_EFFECTIVE_SURFACE_CELL.classify({
    classes:['green','water','hard','bare'],
    types:{green:{},water:{},hard:{},bare:{},pool:{}},
    cellKey:cell=>`${cell.row}:${cell.col}`,
    edgeAreaM2:10,
    predict:()=>null,
    hasWaterFootprint:false,
    waterOutsideClass:()=>null,
    ...input
  });
}

test('raw view always shows the measured raster without applying edits',()=>{
  assert.equal(classify({cell:{classKey:'green',rasterClassKey:'green'},rawView:true,record:{corrections:{'0:0':{to:'hard'}}}}),'green');
});

test('manual class decisions take precedence over spectral prediction and normalize pool to water',()=>{
  const cell={row:0,col:0,classKey:'green',areaM2:100};
  assert.equal(classify({cell,editing:true,record:{corrections:{'0:0':{to:'pool',method:'visual-cell'}},spectralEnabled:true,sens:{hard:100},profile:{cells:{'0:0':{}}}},predict:()=> 'hard'}),'water');
});

test('water footprint policy classifies its raster-water cells before ordinary corrections',()=>{
  const cell={row:0,col:0,classKey:'water',areaM2:100};
  assert.equal(classify({cell,record:{corrections:{'0:0':{to:'green',method:'visual-cell'}}},hasWaterFootprint:true,waterOutsideClass:()=> 'green'}),'green');
});

test('spectral prediction respects edge area and unchanged neutral thresholds',()=>{
  const cell={row:0,col:0,classKey:'green',areaM2:9};
  const record={spectralEnabled:true,sens:{green:50,water:50,hard:100,bare:50},profile:{cells:{'0:0':{}}}};
  assert.equal(classify({cell,record,editing:true,predict:()=> 'hard'}),'green');
  cell.areaM2=100;
  assert.equal(classify({cell,record,editing:true,predict:()=> 'hard'}),'hard');
  record.sens.hard=50;
  assert.equal(classify({cell,record,editing:true,predict:()=> 'hard'}),'green');
});
