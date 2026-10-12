import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const window={};
class Clock{toLocaleDateString(locale){assert.equal(locale,'tr-TR');return '12.10.2026';}}
vm.runInNewContext(readFileSync(new URL('../src/ui/data-request-pending-table.js',import.meta.url),'utf8'),{window,Date:Clock});
const render=window.DG_DATA_REQUEST_PENDING_TABLE_UI.render;
const escape=value=>value==null?'':String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');

test('active request table preserves escaped fields, responsive labels and action callbacks',()=>{
 const row={id:7,profiles:{full_name:'<Ada>'},email:'<email>',country:'TR',city:'Ankara',project_name:'<Park>',note:'<note>',status:'Beklemede',created_at:'2026-10-12'},before=JSON.stringify(row),box={};
 render(box,[row],{escape});
 assert.match(box.innerHTML,/data-label="Kullanıcı">&lt;Ada&gt;/);assert.match(box.innerHTML,/data-label="E‑posta">&lt;email&gt;/);
 assert.match(box.innerHTML,/TR \/ Ankara \/ &amp;lt;Park&amp;gt;/);
 assert.match(box.innerHTML,/data-label="Tarih">12\.10\.2026/);assert.match(box.innerHTML,/class="badge admin">Beklemede/);
 assert.match(box.innerHTML,/onclick="fulfillRequest\(7\)"/);assert.match(box.innerHTML,/onclick="rejectRequest\(7\)"/);
 assert.match(box.innerHTML,/colspan="6"/);assert.match(box.innerHTML,/&lt;note&gt;/);assert.equal(JSON.stringify(row),before);
});

test('active request table keeps missing-field fallbacks and excludes whitespace-only notes',()=>{
 const box={};render(box,[{id:1,status:'İşleme Alındı',note:'   '}],{escape});
 assert.match(box.innerHTML,/data-label="Kullanıcı">—/);assert.match(box.innerHTML,/data-label="Filtre"><b>Tüm Veri/);
 assert.doesNotMatch(box.innerHTML,/📝 Not:/);
});

test('active request table preserves empty state and incoming row order',()=>{
 const box={};render(box,[],{escape});assert.equal(box.innerHTML,"<tr><td colspan=6 style='text-align:center;color:var(--mut)'>Bekleyen talep yok</td></tr>");
 render(box,[{id:9},{id:3}],{escape});assert.ok(box.innerHTML.indexOf('fulfillRequest(9)')<box.innerHTML.indexOf('fulfillRequest(3)'));
});
