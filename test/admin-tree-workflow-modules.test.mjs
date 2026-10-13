import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const files=[
 'src/adapters/admin/admin-persistence-store.js',
 'src/application/admin/refresh-tree-pending-badge.js',
 'src/application/admin/open-pending-tree-nodes.js',
 'src/application/admin/expand-measurement-tree.js',
 'src/application/admin/apply-tree-row-status.js',
 'src/application/admin/remove-tree-row.js'
];
function load(){
 const window={},context=vm.createContext({window,Promise,Number,Set,Array});
 for(const file of files)vm.runInContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),context);
 return window;
}

test('pending badge keeps exact/head query, status filter and silent failures',async()=>{
 const api=load().DG_REFRESH_ADMIN_TREE_PENDING_BADGE,calls=[],updates=[];
 const query={select:(...args)=>{calls.push(['select',...args]);return query;},eq:(...args)=>{calls.push(['eq',...args]);return Promise.resolve({count:4,error:null});}};
 await api.execute({countPendingMeasurements:()=>{calls.push(['from','measurements']);return query.select('*',{count:'exact',head:true}).eq('status','Beklemede');}},n=>updates.push(n));
 assert.deepEqual(JSON.parse(JSON.stringify(calls)),[['from','measurements'],['select','*',{count:'exact',head:true}],['eq','status','Beklemede']]);assert.deepEqual(updates,[4]);
 await api.execute({countPendingMeasurements:async()=>({count:9,error:Error('denied')})},n=>updates.push(n));
 await api.execute({countPendingMeasurements(){throw Error('offline');}},n=>updates.push(n));assert.deepEqual(updates,[4]);
});

test('pending shortcut opens only pending hierarchy keys and renders the filtered tree',()=>{
 const api=load().DG_OPEN_ADMIN_TREE_PENDING_NODES,events=[],keys=new Set();
 const raw=[{id:'pending'}],parks=[{key:'park-a',beklemede:1,projects:[{key:'project-a',beklemede:1,users:[{key:'user-a',beklemede:1},{key:'user-b',beklemede:0}]}]},{key:'park-b',beklemede:0,projects:[]}];
 const tree=api.open(raw,'Beklemede','needle',{filter:(...args)=>{events.push(['filter',...args]);return raw;},group:rows=>{assert.equal(rows,raw);return parks;},openKeys:keys,render:value=>events.push(['render',value])});
 assert.deepEqual(Array.from(keys),['park-a','project-a','user-a']);assert.equal(tree,parks);assert.equal(events[0][0],'filter');assert.equal(events[1][0],'render');
});

test('expand toggles every filtered tree key while collapse clears stale keys',()=>{
 const api=load().DG_EXPAND_ADMIN_MEASUREMENT_TREE,keys=new Set(['stale']),renders=[];
 const tree=[{key:'p',projects:[{key:'j',users:[{key:'u'}]}]}],ports={filter:()=>[],group:()=>tree,render:value=>renders.push(value)};
 api.expand([], '', '', keys, ports, true);assert.deepEqual(Array.from(keys),['p','j','u']);
 api.expand([], '', '', keys, ports, false);assert.deepEqual(Array.from(keys),[]);assert.deepEqual(renders,[tree,tree]);
});

test('optimistic moderation updates the cached row, supports shared and redraws both views',()=>{
 const api=load().DG_APPLY_ADMIN_TREE_ROW_STATUS,rows=[{id:7,status:'Beklemede'}],events=[];
 assert.equal(api.apply(rows,'7','Onaylı',true,{draw:()=>events.push('tree'),renderFlat:value=>events.push(['flat',value])}),true);
 assert.deepEqual(rows,[{id:7,status:'Onaylı',shared:true}]);assert.equal(events[0],'tree');assert.equal(events[1][0],'flat');
 assert.equal(api.apply(rows,8,'Red',null,{draw(){},renderFlat(){}}),false);
 assert.equal(api.apply(rows,7,'Red',false,{draw(){throw Error('view');},renderFlat(){throw Error('flat');}}),true);
 assert.equal(rows[0].shared,false);
});

test('row removal updates cached array and redraws both views only when found',()=>{
 const api=load().DG_REMOVE_ADMIN_TREE_ROW,rows=[{id:1},{id:2}],events=[];
 assert.equal(api.remove(rows,'2',{draw:()=>events.push('tree'),renderFlat:value=>events.push(['flat',value.length])}),true);
 assert.deepEqual(rows,[{id:1}]);assert.deepEqual(events,['tree',['flat',1]]);
 assert.equal(api.remove(rows,2,{draw(){},renderFlat(){}}),false);
 assert.equal(api.remove(rows,1,{draw(){throw Error('view');},renderFlat(){throw Error('flat');}}),true);assert.deepEqual(rows,[]);
});

test('admin tree service delegates each extracted workflow and preserves fallbacks',()=>{
 const source=readFileSync(new URL('../src/services/admin-tree.js',import.meta.url),'utf8');
 for(const api of ['DG_REFRESH_ADMIN_TREE_PENDING_BADGE','DG_OPEN_ADMIN_TREE_PENDING_NODES','DG_EXPAND_ADMIN_MEASUREMENT_TREE','DG_APPLY_ADMIN_TREE_ROW_STATUS','DG_REMOVE_ADMIN_TREE_ROW'])assert.ok(source.includes('window.'+api));
 for(const entry of ['function dgRefreshPendingBadge','function dgTreeOpenPending','function dgTreeExpand','function dgTreeApplyStatus','function dgTreeRemoveRow'])assert.ok(source.includes(entry));
});
