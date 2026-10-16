import {surfaceRuntimeModules} from '../scripts/lib/surface-runtime-modules.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadApp} from '../scripts/test-harness.mjs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const modulePaths=[
  'src/domain/surface/build-validation-confusion-matrix.js',
  'src/domain/surface/build-validation-stratum-weights.js',
  'src/domain/surface/calculate-validation-class-proportions.js',
  'src/domain/surface/calculate-validation-area-estimates.js',
  'src/domain/surface/calculate-validation-class-accuracy.js'
];
const same=(actual,expected)=>assert.equal(JSON.stringify(actual),JSON.stringify(expected));

test('five accuracy domain modules preserve Olofsson matrix, weights, area and class metrics',()=>{
  const legacy=loadApp({sadece:['src/domain/surface/validation-accuracy-metrics.js']}).DG_VALIDATION_ACCURACY_METRICS;
  const composed=loadApp({sadece:[...modulePaths,'src/domain/surface/validation-accuracy-metrics.js']}).DG_VALIDATION_ACCURACY_METRICS;
  const classes=['green','water','hard','bare'];
  const samples=[
    {mapClass:'green',refClass:'green'},{mapClass:'green',refClass:'water'},
    {mapClass:'water',refClass:'water'},{mapClass:'water',refClass:'ambiguous'},
    {mapClass:'hard',refClass:'bare'},{mapClass:'bare',refClass:'bare'},
    {mapClass:'unknown',refClass:'green'},{mapClass:'green',refClass:'unknown'}
  ];
  const actualConfusion=composed.confusion(samples,classes),expectedConfusion=legacy.confusion(samples,classes);
  same(actualConfusion,expectedConfusion);
  const areas={green:6000,water:2500,hard:1000,bare:500},actualWeights=composed.weights(areas,10000,classes),expectedWeights=legacy.weights(areas,10000,classes);
  same(actualWeights,expectedWeights);
  same(composed.metrics(actualConfusion,actualWeights,10000,classes),legacy.metrics(expectedConfusion,expectedWeights,10000,classes));
});

test('accuracy domain modules load before the stable facade and enter live QA and offline cache',()=>{
  const loader=read('src/utils/lazylibs.js'),worker=read('sw.js'),qa=read('scripts/val-qa.mjs');
  const facade='src/domain/surface/validation-accuracy-metrics.js',facadeIndex=loader.indexOf('"'+facade+'"');
  for(const path of modulePaths){const position=loader.indexOf('"'+path+'"');assert.ok(position>=0&&position<facadeIndex,`${path} loader order`);assert.ok(worker.includes("'/"+path+"'"),`${path} precache`);assert.ok(qa.includes('surfaceRuntimeModules(')&&surfaceRuntimeModules(read).includes(path),`${path} live QA`);}
});
