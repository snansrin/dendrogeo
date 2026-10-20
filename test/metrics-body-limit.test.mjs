import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readBoundedText,PayloadTooLargeError} from '../supabase/functions/site-metrics/read-bounded-body.js';

test('metric bodies stop and cancel chunked input at the byte limit without Content-Length',async()=>{
 let pulls=0,cancelled=false;
 const body=new ReadableStream({pull(controller){pulls++;controller.enqueue(new Uint8Array(1024));if(pulls===100)controller.close();},cancel(){cancelled=true;}});
 await assert.rejects(readBoundedText({headers:new Headers(),body},2048),PayloadTooLargeError);
 assert.equal(cancelled,true);
 assert.ok(pulls<=4,'must not read the remainder of an oversized stream');
});

test('metric body limits count UTF-8 bytes and preserve valid boundary-sized JSON',async()=>{
 const text=JSON.stringify({value:'ş'.repeat(1018)});
 assert.ok(text.length<2048);
 assert.equal(new TextEncoder().encode(text).byteLength,2048);
 assert.equal(await readBoundedText(new Request('https://example.invalid',{method:'POST',body:text})),text);
 await assert.rejects(readBoundedText(new Request('https://example.invalid',{method:'POST',body:text+' '})),PayloadTooLargeError);
});

test('declared oversized metric requests are cancelled before reading',async()=>{
 let cancelled=false;
 const body=new ReadableStream({cancel(){cancelled=true;}});
 await assert.rejects(readBoundedText({headers:new Headers({'content-length':'999999'}),body}),PayloadTooLargeError);
 assert.equal(cancelled,true);
 assert.equal(await readBoundedText({headers:new Headers(),body:null}),'');
});
