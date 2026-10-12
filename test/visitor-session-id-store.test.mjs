import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const window={};
vm.runInNewContext(readFileSync(new URL('../src/adapters/visitors/session-id-store.js',import.meta.url),'utf8'),{window,Math});
const load=window.DG_VISITOR_SESSION_ID_STORE.load;

test('presence session ID reuses the existing tab value without writing or generating',()=>{
 const calls=[];
 assert.equal(load({getItem(key){calls.push(key);return 'existing';},setItem(){assert.fail('unexpected write');}},()=>assert.fail('unexpected random')),'existing');
 assert.deepEqual(calls,['dg_sid']);
});

test('presence session ID creates the same eight-character value once and reuses it',()=>{
 const store={},writes=[],random=()=>0.123456789;
 const storage={getItem:key=>store[key],setItem(key,value){store[key]=value;writes.push([key,value]);}};
 const expected=random().toString(36).slice(2,10);
 assert.equal(load(storage,random),expected);
 assert.equal(load(storage,()=>assert.fail('unexpected random')),expected);
 assert.deepEqual(writes,[['dg_sid',expected]]);
});

test('presence session ID transport errors retain the service fallback',()=>{
 const source=readFileSync(new URL('../src/services/visit-stats.js',import.meta.url),'utf8');
 const declaration=source.slice(source.indexOf('const DG_SID='),source.indexOf('const DG_SESSION_START='));
 for(const sessionStorage of [
  {getItem(){throw Error('blocked');}},
  {getItem(){return null;},setItem(){throw Error('quota');}}
 ])assert.equal(vm.runInNewContext(declaration+'DG_SID',{window,sessionStorage}),'x');
 assert.equal(vm.runInNewContext(declaration+'DG_SID',{window}),'x');
});
