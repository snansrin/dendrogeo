import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const now=1791828000000;
function renderer(){
 const window={};
 class Clock extends Date{static now(){return now;}}
 vm.runInNewContext(readFileSync(new URL('../src/ui/visitor-roster.js',import.meta.url),'utf8'),{window,Date:Clock});
 return window.DG_VISITOR_ROSTER_UI;
}
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');

test('visitor roster distinguishes offline, connecting, empty and filtered states',()=>{
 const ui=renderer(),box={};
 for(const [state,allCount,message] of [
  ['on',0,'Şu an bağlı kullanıcı yok.'],
  ['on',2,'Seçili filtrelere uyan kullanıcı yok. Filtreleri temizleyebilirsiniz.'],
  ['connecting',0,'⏳ gerçek zamanlı katmana bağlanılıyor…'],
  ['error',0,'Canlı bağlantı yeniden kuruluyor. Yenile düğmesiyle tekrar bağlanabilirsiniz.']
 ]){
  ui.render(box,[],{state,allCount,translate:s=>'translated:'+s});
  assert.equal(box.textContent,'translated:'+message);
 }
 assert.doesNotThrow(()=>ui.render(null,[]));
});

test('visitor roster preserves escaped metadata, last three views, role and map focus',()=>{
 const box={};
 renderer().render(box,[{age:61,p:{n:'<Ada>',r:'owner',v:'map',la:39,lo:32,hidden:true,st:now-120000,dev:'<device>',vh:[{v:'old'},{v:'dash'},{v:'map'},{v:'nav'}],act:{k:'save',d:'<tree>'},lh:[[39,32],[40,33]]}}],{
  hasLocation:()=>true,viewLabels:{map:'Live map',dash:'Dashboard',nav:'Waypoint'},actionLabels:{save:'saved'},translate:s=>({dk:'min',oturum:'session',gezinti:'views','son eylem':'action',iz:'trail'}[s]||s),escape
 });
 assert.match(box.innerHTML,/data-visitor-lat="39" data-visitor-lon="32" role="button" tabindex="0"/);assert.doesNotMatch(box.innerHTML,/\bonclick\s*=/i);
 assert.match(box.innerHTML,/<b>&lt;Ada&gt;<\/b>/);
 assert.match(box.innerHTML,/badge on.*KURUCU/);
 assert.match(box.innerHTML,/ARKA PLAN/);
 assert.match(box.innerHTML,/&lt;device&gt; · session 2 min/);
 assert.match(box.innerHTML,/views: Dashboard → Live map → Waypoint/);
 assert.doesNotMatch(box.innerHTML,/old/);
 assert.match(box.innerHTML,/action: saved · &lt;tree&gt;/);
 assert.match(box.innerHTML,/trail \(2\)/);
 assert.match(box.innerHTML,/1 min önce/);
});

test('visitor location focus delegates click and keyboard activation',()=>{
 const listeners={},calls=[],box={innerHTML:'',addEventListener:(name,handler)=>{listeners[name]=handler;},contains:()=>true};
 renderer().render(box,[{age:1,p:{n:'Ada',r:'user',v:'map',la:39,lo:32}}],{hasLocation:()=>true,focus:(lat,lon)=>calls.push([lat,lon])});
 const row={dataset:{visitorLat:'39',visitorLon:'32'}},target={closest:selector=>selector==='[data-visitor-lat][data-visitor-lon]'?row:null};listeners.click({target});const keyEvent={target,key:'Enter',preventDefault(){this.prevented=true;}};listeners.keydown(keyEvent);
 assert.equal(keyEvent.prevented,true);assert.deepEqual(calls,[[39,32],[39,32]]);
});

test('visitor roster keeps role badges, age boundary and unlocated cards without focus',()=>{
 const box={};renderer().render(box,[
  {age:59,p:{n:'Admin',r:'admin',v:'unknown'}},
  {age:120,p:{n:'User',r:'user'}},
  {age:121,p:{n:'Old',r:'user'}}
 ],{escape});
 assert.match(box.innerHTML,/badge admin.*DENETÇİ/);
 assert.match(box.innerHTML,/badge off.*KULLANICI/);
 assert.match(box.innerHTML,/59 sn önce/);
 assert.match(box.innerHTML,/unknown/);
 assert.equal((box.innerHTML.match(/ARKA PLAN/g)||[]).length,1);
 assert.doesNotMatch(box.innerHTML,/onclick=|cursor:pointer/);
});
