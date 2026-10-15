import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../src/ui/live-map-controls.js',import.meta.url),'utf8');

test('live map controls delegate park mode, basemap and refresh actions',()=>{
  const listeners=new Map(),calls=[];
  const window={dgToggleParkMode:()=>calls.push('mode'),switchBaseLayer:value=>calls.push(['base',value]),loadLiveMap:()=>calls.push('refresh')};
  const document={addEventListener:(name,handler)=>listeners.set(name,handler)};
  vm.runInContext(source,vm.createContext({window,document}));
  const dispatch=(type,action,value)=>listeners.get(type)({target:{value,closest:selector=>selector.includes('base-layer')?action==='base-layer'?{dataset:{dgMapAction:action},value}:null:action?{dataset:{dgMapAction:action}}:null}});
  dispatch('click','toggle-park-mode');dispatch('change','base-layer','sat');dispatch('click','refresh');
  assert.deepEqual(calls,['mode',['base','sat'],'refresh']);
});

test('static map toolbar has no inline event handlers and module is loaded offline',()=>{
  const shell=readFileSync(new URL('../partials/shell.html',import.meta.url),'utf8');
  const start=shell.indexOf('<div class="view" id="v-map">'),end=shell.indexOf('<div class="view" id="v-projects">',start);
  const map=shell.slice(start,end);
  assert.doesNotMatch(map,/\son(?:click|change)\s*=/i);
  assert.match(map,/data-dg-map-action="base-layer"/);
  assert.match(readFileSync(new URL('../partials/boot.html',import.meta.url),'utf8'),/waypoint-actions\.js[\s\S]*live-map-controls\.js/);
  assert.match(readFileSync(new URL('../sw.js',import.meta.url),'utf8'),/'\/src\/ui\/live-map-controls\.js'/);
});
