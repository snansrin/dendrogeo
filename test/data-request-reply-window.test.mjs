import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const window={};vm.runInNewContext(readFileSync(new URL('../src/adapters/data-requests/reply-window.js',import.meta.url),'utf8'),{window,encodeURIComponent});
const open=window.DG_DATA_REQUEST_REPLY_WINDOW.open;

test('request reply preserves encoded subject, UTF-8 body, blank target and browser receiver',()=>{
 const calls=[],result={closed:false},browser={open(url,target){assert.equal(this,browser);calls.push([url,target]);return result;}};
 const subject=encodeURIComponent('✅ Veri hazır — 2 kayıt, 1.50 t C'),body='Merhaba Ada,\n\nÜlke: Türkiye & şehir: Ankara\n+ % ? #';
 assert.equal(open(browser,'qa@example.test',subject,body),result);
 assert.deepEqual(calls,[['mailto:qa@example.test?subject='+subject+'&body='+encodeURIComponent(body),'_blank']]);
 assert.equal(new URL(calls[0][0]).searchParams.get('subject'),'✅ Veri hazır — 2 kayıt, 1.50 t C');
 assert.equal(new URL(calls[0][0]).searchParams.get('body'),body);
});

test('request reply keeps empty recipient/body behavior and blocked-window return',()=>{
 let actual;const result=open({open(url,target){actual=[url,target];return null;}},'','already%20encoded','');
 assert.equal(result,null);assert.deepEqual(actual,['mailto:?subject=already%20encoded&body=','_blank']);
});

test('request reply preserves browser exceptions for the service call boundary',()=>{
 assert.throws(()=>open({open(){throw Error('blocked');}},'qa@example.test','subject','body'),/blocked/);
});
