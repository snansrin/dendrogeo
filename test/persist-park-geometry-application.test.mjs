import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const context=vm.createContext({window:{}});
vm.runInContext(readFileSync(new URL('../src/application/parks/persist-park-geometry.js',import.meta.url),'utf8'),context);
const create=context.window.DG_PARK_GEOMETRY_APPLICATION.create;
const simplifyRing=(ring,max)=>ring.length>max?[...ring.slice(0,max),ring[0]]:ring;
const outer=[[1,2],[3,4],[5,6],[7,8]];
const hole=[[2,3],[4,5],[6,7]];

test('geometry use-case simplifies outer and inner rings and returns the saved park',async()=>{
  const writes=[];
  const saved={id:7,name:'Park',geom_json:{outer:[outer],inner:[hole]}};
  const persist=create({getGeometry:()=>({outer,inner:[hole,[[1,1],[2,2]]]}),maxPoints:3,simplifyRing,updateGeometry:async(...args)=>{writes.push(args);return{data:saved,error:null};},warn(){}});
  assert.equal(await persist({id:7,name:'Park'}),saved);
  assert.equal(writes.length,1);
  assert.equal(writes[0][0],7);
  assert.deepEqual(JSON.parse(JSON.stringify(writes[0][1])),{outer:[[[1,2],[3,4],[5,6],[1,2]]],inner:[hole]});
});

test('missing park or usable outer boundary skips persistence',async()=>{
  let writes=0;
  const park={id:7};
  const persist=create({getGeometry:()=>({outer:[[1,2]],inner:[]}),maxPoints:3,simplifyRing,updateGeometry:async()=>{writes++;return{data:null,error:null};},warn(){}});
  assert.equal(await persist(park),park);
  assert.equal(await persist(null),null);
  assert.equal(writes,0);
});

test('write errors and thrown failures preserve the original park for circle fallback',async()=>{
  const park={id:7,name:'Park'};
  const warnings=[];
  const common={getGeometry:()=>({outer,inner:[]}),maxPoints:3,simplifyRing,warn:(...args)=>warnings.push(args)};
  const rejected=create({...common,updateGeometry:async()=>({data:null,error:Error('denied')})});
  assert.equal(await rejected(park),park);
  const thrown=create({...common,updateGeometry:async()=>{throw Error('offline');}});
  assert.equal(await thrown(park),park);
  assert.deepEqual(warnings.map(([kind])=>kind),['write-error','exception']);
});

test('successful empty response retains the input park',async()=>{
  const park={id:7};
  const persist=create({getGeometry:()=>({outer,inner:[]}),maxPoints:3,simplifyRing,updateGeometry:async()=>({data:null,error:null}),warn(){}});
  assert.equal(await persist(park),park);
});
