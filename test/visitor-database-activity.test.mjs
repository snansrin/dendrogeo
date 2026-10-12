import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

function renderer(){
 const window={};
 vm.runInNewContext(readFileSync(new URL('../src/ui/visitor-database-activity.js',import.meta.url),'utf8'),{window,Date});
 return window.DG_VISITOR_DATABASE_ACTIVITY_UI;
}

test('stored visitor activity renderer preserves escaped, translated responsive rows',()=>{
 const ui=renderer(),box={innerHTML:'',textContent:''};
 const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
 ui.render(box,[{t:'2026-10-12T12:00:00Z',who:'<Ada>',what:'created',det:'<park>'}],{
  locale:'en-GB',translate:value=>({Zaman:'Time',Kim:'Who','Ne yaptı':'Action',Ayrıntı:'Details',created:'created'}[value]||value),escape
 });
 assert.match(box.innerHTML,/<th scope="col">Time<\/th>/);
 assert.match(box.innerHTML,/data-label="Who">&lt;Ada&gt;/);
 assert.match(box.innerHTML,/data-label="Details">&lt;park&gt;/);
 assert.match(box.innerHTML,/class="mono" style="white-space:nowrap"/);
});

test('stored visitor activity renderer keeps empty state and 60-row cap',()=>{
 const ui=renderer(),box={innerHTML:'',textContent:''};
 ui.render(box,[],{translate:value=>value==='Etkinlik yok'?'No activity':value});
 assert.equal(box.innerHTML,'<div class="alert info">No activity</div>');
 ui.render(box,Array.from({length:65},(_,index)=>({who:'User '+index})),{escape:String});
 assert.equal((box.innerHTML.match(/<tr><td/g)||[]).length,60);
});
