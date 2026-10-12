import {test} from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const window={};vm.runInNewContext(readFileSync(new URL('../src/adapters/backup/paged-store.js',import.meta.url),'utf8'),{window});
function client(pages){const calls=[];let index=0;return{calls,sb:{from(table){calls.push(['from',table]);return{select(columns){calls.push(['select',columns]);return this;},order(column){calls.push(['order',column]);return this;},range(from,to){calls.push(['range',from,to]);return Promise.resolve(pages[index++]);}};}}};}
test('backup pagination preserves exact 1000-row ranges, order and complete row identity',async()=>{
 const first=Array.from({length:1000},(_,id)=>({id})),last=[{id:1000}],a=client([{data:first},{data:last}]);const rows=await window.DG_BACKUP_PAGED_STORE.load(a.sb,'measurements','created_at');
 assert.equal(rows.length,1001);assert.equal(rows[0],first[0]);assert.equal(rows[1000],last[0]);assert.deepEqual(a.calls.filter(c=>c[0]==='range'),[['range',0,999],['range',1000,1999]]);assert.ok(a.calls.some(c=>c[0]==='order'&&c[1]==='created_at'));
});
test('backup pagination performs terminal empty read at exact page size and propagates table-qualified errors',async()=>{
 const a=client([{data:Array(1000).fill({id:1})},{data:null}]);assert.equal((await window.DG_BACKUP_PAGED_STORE.load(a.sb,'projects','id')).length,1000);assert.equal(a.calls.filter(c=>c[0]==='range').length,2);
 const b=client([{data:[],error:{message:'denied'}}]);await assert.rejects(window.DG_BACKUP_PAGED_STORE.load(b.sb,'projects','id'),/projects: denied/);
});
