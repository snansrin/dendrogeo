import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../src/ui/admin-user-actions.js',import.meta.url),'utf8');

test('admin user controls delegate filters, role updates and active toggles',()=>{
 const listeners=new Map(),calls=[],window={};
 for(const name of ['loadUsers','filterUsers','updateRole','toggleU'])window[name]=function(...args){calls.push([name,this===window,...args]);};
 const document={addEventListener:(name,handler)=>listeners.set(name,handler)};
 vm.runInContext(source,vm.createContext({window,document}));
 const element=(action,extra={})=>({dataset:{dgAdminUserAction:action,...extra},value:'admin'});
 const dispatch=(type,target)=>listeners.get(type)({target:{closest:()=>target}});
 dispatch('click',element('load'));
 dispatch('input',element('filter'));
 dispatch('change',element('filter'));
 dispatch('change',element('role',{dgUserId:'u-7'}));
 dispatch('click',element('toggle',{dgUserId:'u-7',dgUserActive:'false'}));
 assert.deepEqual(calls.map(([name])=>name),['loadUsers','filterUsers','filterUsers','updateRole','toggleU']);
 assert.ok(calls.every(([,receiver])=>receiver));
 assert.deepEqual(calls[3].slice(2),['u-7','admin']);
 assert.deepEqual(calls[4].slice(2),['u-7',false]);
});

test('user admin actions remain declarative and cached with the shell',()=>{
 const shell=readFileSync(new URL('../partials/shell.html',import.meta.url),'utf8');
 const table=readFileSync(new URL('../src/ui/admin-user-table.js',import.meta.url),'utf8');
 const boot=readFileSync(new URL('../partials/boot.html',import.meta.url),'utf8');
 const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 const view=shell.slice(shell.indexOf('id="v-users"'),shell.indexOf('id="v-visitors"'));
 assert.doesNotMatch(view,/\bon(?:click|change|input|submit)\s*=/i);
 assert.doesNotMatch(table,/\bon(?:click|change|input|submit)\s*=/i);
 assert.match(view,/data-dg-admin-user-action="filter"/);
 assert.match(table,/data-dg-admin-user-action="role"/);
 assert.match(boot,/src\/ui\/admin-user-actions\.js/);
 assert.match(sw,/\/src\/ui\/admin-user-actions\.js/);
});
