import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/ui/shell.js',import.meta.url),'utf8');
const registration=source.slice(source.indexOf("    if('serviceWorker'"),source.indexOf('    // 1b.'));

for(const activePark of [false,true])test(`worker activation preserves the open page (park mode ${activePark})`,async()=>{
  const listeners=new Map();
  let reloads=0,updates=0,registrations=0;
  const serviceWorker={
    controller:{},
    addEventListener(name,handler){listeners.set(name,handler);},
    register:async(path,options)=>{
      registrations++;
      assert.equal(path,'./sw.js');
      assert.equal(options.updateViaCache,'none');
      return {update:async()=>{updates++;listeners.get('controllerchange')?.();}};
    }
  };
  const window={};
  const context=vm.createContext({window,navigator:{serviceWorker},PARK_MODE:activePark,
    location:{reload(){reloads++;}},sessionStorage:{getItem(){throw Error('storage blocked');}},console});
  vm.runInContext(`async function registerWorker(){${registration}};registerWorker();`,context);
  await new Promise(resolve=>setImmediate(resolve));
  listeners.get('controllerchange')?.();
  assert.equal(reloads,0);
  assert.equal(updates,1);
  vm.runInContext('registerWorker();',context);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(registrations,1);
  assert.equal(context.PARK_MODE,activePark);
});
