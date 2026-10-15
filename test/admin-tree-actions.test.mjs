import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../src/ui/admin-tree-actions.js',import.meta.url),'utf8');

test('admin tree actions preserve filter, pending shortcuts, and measurement search callbacks',()=>{
 const listeners=new Map(),calls=[],window={};
 for(const name of ['dgTreeOnlyPending','dgTreeOpenPending','loadAdminTree','dgTreeSetQuery','dgTreeSetStatus','filterAdminMeas','dgTreeExpand','dgTreeDeleteProject','dgTreePendingScan'])window[name]=function(...args){calls.push([name,this===window,...args]);};
 const elements={adminPendingBadge:{style:{},textContent:''},treeStatus:{value:''}};
 const document={addEventListener:(name,handler)=>listeners.set(name,handler),getElementById:id=>elements[id]||null};window.document=document;
 vm.runInContext(source,vm.createContext({window,document}));
 const element=(action,extra={})=>({dataset:{dgAdminTreeAction:action,...extra},value:'Beklemede'});
 const dispatch=(type,target)=>listeners.get(type)({target:{closest:()=>target}});
 dispatch('click',element('only-pending'));dispatch('click',element('open-pending'));dispatch('click',element('load'));
 dispatch('click',element('expand-all'));dispatch('click',element('collapse-all'));dispatch('click',element('delete-project',{projectId:'42'}));dispatch('click',element('scan-park'));
 dispatch('input',element('query'));dispatch('input',element('filter-measurements'));
 dispatch('change',element('status'));
 assert.deepEqual(calls.map(([name])=>name),['dgTreeOnlyPending','dgTreeOpenPending','loadAdminTree','dgTreeExpand','dgTreeExpand','dgTreeDeleteProject','dgTreePendingScan','dgTreeSetQuery','filterAdminMeas','dgTreeSetStatus']);
 assert.ok(calls.every(([,receiver])=>receiver));
 assert.deepEqual(calls[3].slice(2),[true]);assert.deepEqual(calls[4].slice(2),[false]);
 assert.equal(calls[5][2].target.closest().dataset.dgAdminTreeAction,'delete-project');assert.equal(calls[5][3],42);
 assert.deepEqual(calls[7].slice(2),['Beklemede']);
 assert.deepEqual(calls[9].slice(2),['Beklemede']);
 window.DG_ADMIN_TREE_ACTIONS.updateBadge(125);assert.equal(elements.adminPendingBadge.textContent,'99+');assert.equal(elements.adminPendingBadge.style.display,'inline-block');
 window.DG_ADMIN_TREE_ACTIONS.updateBadge(0);assert.equal(elements.adminPendingBadge.textContent,'');assert.equal(elements.adminPendingBadge.style.display,'none');
 window.DG_ADMIN_TREE_ACTIONS.setStatusValue('Red');assert.equal(elements.treeStatus.value,'Red');
 assert.equal(window.DG_ADMIN_TREE_ACTIONS.getElement('adminPendingBadge'),elements.adminPendingBadge);
});

test('admin tree shell actions load through the offline module chain',()=>{
 const shell=readFileSync(new URL('../partials/shell.html',import.meta.url),'utf8');
 const boot=readFileSync(new URL('../partials/boot.html',import.meta.url),'utf8');
 const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 const view=shell.slice(shell.indexOf('id="treeStatus"'),shell.indexOf('id="v-users"'));
 assert.doesNotMatch(view,/\bon(?:click|change|input|submit)\s*=/i);
 assert.match(view,/data-dg-admin-tree-action="status"/);
 assert.match(view,/data-dg-admin-tree-action="filter-measurements"/);
 assert.match(boot,/src\/ui\/admin-tree-actions\.js/);
 assert.match(sw,/\/src\/ui\/admin-tree-actions\.js/);
});
