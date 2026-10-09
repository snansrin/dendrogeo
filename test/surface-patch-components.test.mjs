import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const ctx=vm.createContext({window:{}});
vm.runInContext(readFileSync(new URL('../src/domain/surface/group-patch-cells.js',import.meta.url),'utf8'),ctx);
const group=cells=>ctx.window.DG_SURFACE_PATCH_COMPONENTS.groupCells(cells);
const cell=(id,row,col,classKey='green',epsg=32636)=>({id,row,col,classKey,epsg});

test('same-class 4-neighbor cells form one component in stable traversal order',()=>{
  const cells=[cell('a',0,0),cell('b',1,0),cell('diagonal',1,1),cell('hard',0,1,'hard')];
  const groups=group(cells);
  assert.deepEqual(Array.from(groups,component=>Array.from(component,c=>c.id)),[['a','b','diagonal'],['hard']]);
});

test('diagonal-only contact, different classes, and different CRS remain separate',()=>{
  const groups=group([cell('a',0,0),cell('diagonal',1,1),cell('crs',0,0,'green',3857)]);
  assert.deepEqual(Array.from(groups,component=>Array.from(component,c=>c.id)),[['a'],['diagonal'],['crs']]);
});

test('empty input yields no components',()=>assert.deepEqual(Array.from(group([])),[]));
