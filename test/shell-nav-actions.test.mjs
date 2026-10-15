import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../src/ui/shell-nav-actions.js',import.meta.url),'utf8');

test('shell navigation delegates click and keyboard activation without markup handlers',()=>{
  const listeners=new Map(),navigations=[],document={addEventListener:(name,handler)=>listeners.set(name,handler)};
  const window={go:view=>navigations.push(view)};
  const context=vm.createContext({window,document});
  vm.runInContext(source,context);
  const item={dataset:{dgView:'measure'}},event={target:{closest:selector=>selector==='[data-dg-view]'?item:null},key:'Enter',prevented:false,preventDefault(){this.prevented=true;}};

  listeners.get('click')(event);
  listeners.get('keydown')(event);
  assert.deepEqual(navigations,['measure','measure']);
  assert.equal(event.prevented,true);

  const ignored={target:{closest:()=>null},key:'Escape',preventDefault(){throw Error('irrelevant key prevented');}};
  listeners.get('keydown')(ignored);
  assert.deepEqual(navigations,['measure','measure']);
});
