import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const bindSource=readFileSync(new URL('../src/ui/bind-surface-editor-events.js',import.meta.url),'utf8');

test('surface editor declarative click/change/input/toggle controls invoke injected actions once',()=>{
  const window={};vm.runInNewContext(bindSource,{window});
  const listeners={},container={addEventListener:(type,callback)=>{listeners[type]=callback;},contains:()=>true};
  const calls=[],actions={save:(element,event)=>calls.push(['save',element.dataset.dgClick,event.type]),range:element=>calls.push(['range',element.value]),menu:element=>calls.push(['menu',element.open])};
  window.DG_BIND_SURFACE_EDITOR_EVENTS.bind(container,actions);
  window.DG_BIND_SURFACE_EDITOR_EVENTS.bind(container,actions);
  const button={dataset:{dgClick:'save'},disabled:false,closest:()=>button};
  listeners.click({target:button,type:'click'});
  const slider={dataset:{dgInput:'range'},value:'42',disabled:false,closest:()=>slider};
  listeners.input({target:slider});
  const menu={dataset:{dgToggle:'menu'},open:true,matches:()=>true};
  listeners.toggle({target:menu});
  assert.deepEqual(calls,[['save','save','click'],['range','42'],['menu',true]]);
  assert.equal(Object.keys(listeners).length,4,'listeners are installed once per stable root');
});

test('surface editor renderer templates contain no inline handlers and load their event adapter before the facade',()=>{
  for(const path of ['render-surface-editor-menus.js','render-surface-editor-tool-rail.js','render-surface-review-actions.js','render-surface-scan-panel.js','render-surface-sensitivity-controls.js']){
    assert.doesNotMatch(readFileSync(new URL('../src/ui/'+path,import.meta.url),'utf8'),/\son[a-z]+\s*=/i,path);
  }
  const lazy=readFileSync(new URL('../src/utils/lazylibs.js',import.meta.url),'utf8');
  assert.ok(lazy.indexOf('src/ui/bind-surface-editor-events.js')<lazy.indexOf('src/ui/lc-sens.js'));
  assert.match(readFileSync(new URL('../src/ui/lc-sens.js',import.meta.url),'utf8'),/DG_BIND_SURFACE_EDITOR_EVENTS/);
});
