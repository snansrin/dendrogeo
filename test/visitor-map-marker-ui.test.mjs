import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const window={};
vm.runInNewContext(readFileSync(new URL('../src/ui/visitor-map-marker.js',import.meta.url),'utf8'),{window});
const build=window.DG_VISITOR_MAP_MARKER_UI.build;
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');

test('visitor map marker keeps Turkish initial, icon geometry and color',()=>{
 const result=build({p:{n:'  izel',v:'map'},age:59},{color:'#123456',escape});
 assert.match(result.icon.html,/background:#123456/);
 assert.match(result.icon.html,/>İ<\/div>$/);
 assert.deepEqual(Array.from(result.icon.iconSize),[20,20]);
 assert.deepEqual(Array.from(result.icon.iconAnchor),[10,10]);
 assert.equal(result.icon.className,'');
 assert.equal(result.tooltipOptions.direction,'top');
 assert.deepEqual(Array.from(result.tooltipOptions.offset),[0,-12]);
});

test('visitor map tooltip escapes names and translated views and keeps age boundary',()=>{
 const translate=s=>({map:'<Map>',sn:'sec',dk:'min','son konum':'last location',önce:'ago'}[s]||s);
 const result=build({p:{n:'<Ada>',v:'map'},age:60},{translate,escape});
 assert.equal(result.tooltip,'<b>&lt;Ada&gt;</b><br>&lt;Map&gt;<br>last location: 1 min ago');
 assert.match(result.icon.html,/>&lt;<\/div>$/);
 assert.match(build({p:{n:'Ada'},age:59},{translate,escape}).tooltip,/59 sec ago$/);
 assert.match(build({p:{n:'Ada'},age:90},{translate,escape}).tooltip,/2 min ago$/);
});

test('visitor map marker retains missing-name and unknown-view fallbacks without mutating rows',()=>{
 const row={p:{v:'unrecognized'},age:0},before=JSON.stringify(row);
 const result=build(row,{escape});
 assert.match(result.icon.html,/background:#2b6cb0/);
 assert.match(result.icon.html,/>\?<\/div>$/);
 assert.equal(result.tooltip,'<b>?</b><br>unrecognized<br>son konum: 0 sn önce');
 assert.equal(JSON.stringify(row),before);
 assert.match(build({p:{n:''},age:0},{escape}).tooltip,/<b>\?<\/b><br><br>/);
});
