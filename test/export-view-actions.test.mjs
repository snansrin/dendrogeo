import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../src/ui/export-view-actions.js',import.meta.url),'utf8');

test('export view buttons delegate to the same download and preview entry points',()=>{
  const listeners=new Map(),calls=[];
  const window={exportCSV:()=>calls.push('csv'),previewCSV:()=>calls.push('csv-preview'),exportGeo:()=>calls.push('geo'),previewGeo:()=>calls.push('geo-preview'),exportQgis:()=>calls.push('qgis')};
  const document={addEventListener:(name,handler)=>listeners.set(name,handler)};
  vm.runInContext(source,vm.createContext({window,document}));
  for(const action of ['csv-download','csv-preview','geo-download','geo-preview','qgis-download'])listeners.get('click')({target:{closest:selector=>selector==='[data-dg-export-action]'?{dataset:{dgExportAction:action}}:null}});
  assert.deepEqual(calls,['csv','csv-preview','geo','geo-preview','qgis']);
});

test('export download buttons are declarative and the UI module is loaded offline',()=>{
  const shell=readFileSync(new URL('../partials/shell.html',import.meta.url),'utf8');
  for(const action of ['csv-download','csv-preview','geo-download','geo-preview','qgis-download'])assert.match(shell,new RegExp(`data-dg-export-action="${action}"`));
  const boot=readFileSync(new URL('../partials/boot.html',import.meta.url),'utf8'),sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
  assert.match(boot,/project-edit-actions\.js[\s\S]*export-view-actions\.js/);
  assert.match(sw,/'\/src\/ui\/export-view-actions\.js'/);
});
