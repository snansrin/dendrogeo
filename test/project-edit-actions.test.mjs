import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../src/ui/project-edit-actions.js',import.meta.url),'utf8');

test('project edit events delegate name preview, save and cancel to existing workflows',()=>{
  const listeners=new Map(),calls=[];
  const window={dgProjectNamePreview:()=>calls.push('preview'),createProject:()=>calls.push('save'),cancelProjectEdit:()=>calls.push('cancel')};
  const document={addEventListener:(name,handler)=>listeners.set(name,handler)};
  vm.runInContext(source,vm.createContext({window,document}));
  const dispatch=(type,action)=>{const element={dataset:{dgProjectAction:action}};listeners.get(type)({target:{closest:selector=>selector==="[data-dg-project-action]"||selector.includes(action)?element:null}});};
  dispatch('input','preview-name');dispatch('click','save');dispatch('click','cancel');
  assert.deepEqual(calls,['preview','save','cancel']);
});

test('project edit controls have declarative markup and are loaded offline',()=>{
  const shell=readFileSync(new URL('../partials/shell.html',import.meta.url),'utf8');
  const start=shell.indexOf('<details class="card project-create"'),end=shell.indexOf('</details>',start),form=shell.slice(start,end);
  assert.doesNotMatch(form,/\son(?:click|input)\s*=/i);
  assert.match(form,/data-dg-project-action="preview-name"/);
  const boot=readFileSync(new URL('../partials/boot.html',import.meta.url),'utf8');
  const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
  assert.match(boot,/measurement-form-actions\.js[\s\S]*project-edit-actions\.js/);
  assert.match(sw,/'\/src\/ui\/project-edit-actions\.js'/);
});
