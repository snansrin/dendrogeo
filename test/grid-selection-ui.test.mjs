import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const context=vm.createContext({window:{}});
vm.runInContext(readFileSync(new URL('../src/ui/grid-selection.js',import.meta.url),'utf8'),context);
const create=context.window.DG_GRID_SELECTION_UI.create;
function setup(){
 let cells=[{id:'a',measured:true},{id:'b',measured:false}];
 const selected=new Set(),styles=[],summaries=[];
 const items=[{_cellId:'a',setStyle:s=>styles.push(['a',s])},{_cellId:'b',setStyle:s=>styles.push(['b',s])},{_cellId:'orphan',setStyle:()=>assert.fail('orphan layer must not be styled')},{}];
 const ui=create({getCells:()=>cells,getSelection:()=>selected,getLayer:()=>({eachLayer:fn=>items.forEach(fn)}),resolveStyle:(cell,active)=>({measured:cell.measured,active}),countStates:rows=>({measured:rows.filter(x=>x.measured).length,empty:rows.filter(x=>!x.measured).length}),updateSummary:(...s)=>summaries.push(s)});
 return{ui,selected,styles,summaries,replace:next=>{cells=next;},rect:{setStyle:s=>styles.push(['clicked',s])}};
}
test('toggle twice restores selection and preserves measurement state',()=>{
 const x=setup();x.ui.toggle('a',x.rect);assert.deepEqual([...x.selected],['a']);x.ui.toggle('a',x.rect);assert.equal(x.selected.size,0);assert.deepEqual(x.styles,[['clicked',{measured:true,active:true}],['clicked',{measured:true,active:false}]]);assert.deepEqual(x.summaries,[[1,1],[1,1]]);
});
test('clear resets matching layers, ignores stale layers and refreshes counts',()=>{
 const x=setup();x.selected.add('a');x.selected.add('b');x.ui.clear();assert.equal(x.selected.size,0);assert.deepEqual(x.styles,[['a',{measured:true,active:false}],['b',{measured:false,active:false}]]);assert.deepEqual(x.summaries,[[1,1]]);
});
test('selection reads replacement grid state instead of retaining the old cell array',()=>{
 const x=setup();x.replace([{id:'a',measured:false}]);x.ui.toggle('a',x.rect);assert.deepEqual(x.styles,[['clicked',{measured:false,active:true}]]);assert.deepEqual(x.summaries,[[0,1]]);
});
