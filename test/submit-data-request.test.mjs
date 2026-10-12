import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const window={};vm.runInNewContext(readFileSync(new URL('../src/application/data-requests/submit-request.js',import.meta.url),'utf8'),{window});
const execute=window.DG_SUBMIT_DATA_REQUEST.execute;
function ports({duplicate=null,checkReject=false,insertError=null,insertReject=false}={}){
 const calls=[],pending=[{id:1}],body={status:'Beklemede'};
 return{calls,api:{readPending:async()=>{calls.push('read');if(checkReject)throw Error('offline');return{data:pending};},findDuplicate:rows=>{assert.equal(rows,pending);calls.push('match');return duplicate;},onDuplicate:row=>{assert.equal(row,duplicate);calls.push('duplicate');},onCheckError:error=>{assert.match(error.message,/offline|render/);calls.push('check-error');},buildBody:()=>{calls.push('body');return body;},insert:async value=>{assert.equal(value,body);calls.push('insert');if(insertReject)throw Error('insert transport');return{error:insertError};},onInsertError:error=>{assert.equal(error,insertError);calls.push('insert-error');},onSuccess:()=>calls.push('success')}};
}

test('submission use case preserves lazy body construction, success and duplicate early return',async()=>{
 const a=ports();await execute(a.api);assert.deepEqual(a.calls,['read','match','body','insert','success']);
 const b=ports({duplicate:{id:1}});await execute(b.api);assert.deepEqual(b.calls,['read','match','duplicate']);
});

test('submission use case retains pending and duplicate-notification error fallback',async()=>{
 const a=ports({checkReject:true});await execute(a.api);assert.deepEqual(a.calls,['read','check-error','body','insert','success']);
 const b=ports({duplicate:{id:1}});b.api.onDuplicate=()=>{b.calls.push('duplicate');throw Error('render');};await execute(b.api);assert.deepEqual(b.calls,['read','match','duplicate','check-error','body','insert','success']);
});

test('submission use case separates insert API errors from transport rejection',async()=>{
 const a=ports({insertError:{message:'denied'}});await execute(a.api);assert.deepEqual(a.calls,['read','match','body','insert','insert-error']);
 const b=ports({insertReject:true});await assert.rejects(execute(b.api),/insert transport/);assert.deepEqual(b.calls,['read','match','body','insert']);
});
