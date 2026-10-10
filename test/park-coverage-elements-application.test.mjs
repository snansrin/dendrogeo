import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/application/parks/classify-coverage-elements.js',import.meta.url),'utf8');
const context=vm.createContext({window:{}});
vm.runInContext(source,context);
const classify=(elements,calls)=>context.window.DG_PARK_COVERAGE_ELEMENT_CLASSIFIER.classify(elements,{
  isWater:element=>{calls.water.push(element.id);return element.kind==='water';},
  isImpervious:element=>{calls.impervious.push(element.id);return element.kind==='hard';}
});

test('coverage routing preserves input order, water precedence, and per-kind deduplication',()=>{
  const water={type:'way',id:1,kind:'water'};
  const waterDuplicate={type:'way',id:1,kind:'water'};
  const path={type:'way',id:2,kind:'soft',tags:{highway:'footway'}};
  const hard={type:'way',id:3,kind:'hard',tags:{surface:'asphalt'}};
  const hardDuplicate={type:'way',id:3,kind:'hard',tags:{surface:'asphalt'}};
  const calls={water:[],impervious:[]};

  const rows=Array.from(classify([water,waterDuplicate,path,hard,hardDuplicate],calls),row=>({
    element:row.element,
    water:row.water,
    skip:row.skip,
    pedestrian:row.pedestrian,
    impervious:row.impervious
  }));

  assert.deepEqual(rows,[
    {element:water,water:true,skip:false,pedestrian:false,impervious:false},
    {element:waterDuplicate,water:true,skip:true,pedestrian:false,impervious:false},
    {element:path,water:false,skip:false,pedestrian:true,impervious:false},
    {element:hard,water:false,skip:false,pedestrian:false,impervious:true},
    {element:hardDuplicate,water:false,skip:false,pedestrian:false,impervious:false}
  ]);
  assert.deepEqual(calls.water,[1,1,2,3,3]);
  assert.deepEqual(calls.impervious,[2,3,3]);
});

test('classification state is scoped to one query and water never reaches impervious rules',()=>{
  const element={type:'relation',id:8,kind:'water'};
  const calls={water:[],impervious:[]};
  const first=Array.from(classify([element,element],calls),row=>row.skip);
  const second=Array.from(classify([element],calls),row=>row.skip);
  assert.deepEqual(first,[false,true]);
  assert.deepEqual(second,[false]);
  assert.deepEqual(calls.impervious,[]);
});
