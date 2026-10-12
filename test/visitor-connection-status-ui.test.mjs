import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const window={};
class Clock{toLocaleTimeString(locale,options){assert.equal(locale,'tr-TR');assert.deepEqual(JSON.parse(JSON.stringify(options)),{hour:'2-digit',minute:'2-digit'});return '15:30';}}
vm.runInNewContext(readFileSync(new URL('../src/ui/visitor-connection-status.js',import.meta.url),'utf8'),{window,Date:Clock});
const ui=window.DG_VISITOR_CONNECTION_STATUS_UI;

test('visitor status preserves connection text, counts, local time and color state',()=>{
 const wrapper={dataset:{}},element={closest(selector){assert.equal(selector,'.visitor-connection');return wrapper;}};
 for(const state of ['on','connecting','error','idle']){
  ui.render(element,state,2,5);
  assert.equal(element.textContent,(state==='on'?'Canlı bağlantı':'Bağlantı: '+state)+' · 2 / 5 kullanıcı · 15:30');
  assert.equal(wrapper.dataset.state,state);
 }
});

test('visitor status tolerates absent wrapper and paused text retains connection color',()=>{
 const wrapper={dataset:{state:'on'}},element={closest:()=>wrapper};
 ui.paused(element);assert.equal(element.textContent,'Görünüm duraklatıldı');assert.equal(wrapper.dataset.state,'on');
 ui.render({closest:()=>null},'on',0,0);
 assert.doesNotThrow(()=>{ui.render(null,'on',0,0);ui.paused(null);});
});
