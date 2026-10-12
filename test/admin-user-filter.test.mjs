import {test} from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const window={};vm.runInNewContext(readFileSync(new URL('../src/ui/admin-user-filter.js',import.meta.url),'utf8'),{window});
test('user filtering combines Turkish search, role and status and clears previous hiding',()=>{
 const rows=[{textContent:'İZEL',dataset:{role:'user',status:'active'},style:{}},{textContent:'İzel',dataset:{role:'admin',status:'active'},style:{}},{textContent:'Ada',dataset:{role:'user',status:'passive'},style:{}}],table={querySelectorAll:selector=>{assert.equal(selector,'tr');return rows;}};
 assert.equal(window.DG_ADMIN_USER_FILTER_UI.apply(table,{query:' izel ',role:'user',status:'active'}),1);assert.deepEqual(rows.map(r=>r.style.display),['','none','none']);
 assert.equal(window.DG_ADMIN_USER_FILTER_UI.apply(table),3);assert.deepEqual(rows.map(r=>r.style.display),['','','']);
 assert.equal(window.DG_ADMIN_USER_FILTER_UI.apply(table,{status:'passive'}),1);
});
test('user filtering keeps empty and missing row text behavior',()=>{
 const row={dataset:{},style:{}},table={querySelectorAll:()=>[row]};
 assert.equal(window.DG_ADMIN_USER_FILTER_UI.apply(table,{query:'no match'}),0);assert.equal(row.style.display,'none');
 assert.equal(window.DG_ADMIN_USER_FILTER_UI.apply({querySelectorAll:()=>[]}),0);
});
