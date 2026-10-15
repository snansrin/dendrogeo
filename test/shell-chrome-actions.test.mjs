import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../src/ui/shell-chrome-actions.js',import.meta.url),'utf8');

test('persistent shell controls call the existing install, locale, and logout APIs',()=>{
 const listeners=new Map(),calls=[],window={};
 for(const name of ['dgInstallApp','dgToggleLang','logout'])window[name]=function(){calls.push([name,this===window]);};
 const document={addEventListener:(name,handler)=>listeners.set(name,handler)};
 vm.runInContext(source,vm.createContext({window,document}));
 for(const action of ['install','toggle-language','logout']){
  const element={dataset:{dgChromeAction:action}};
  listeners.get('click')({target:{closest:()=>element}});
 }
 assert.deepEqual(calls.map(([name])=>name),['dgInstallApp','dgToggleLang','logout']);
 assert.ok(calls.every(([,receiver])=>receiver));
});

test('persistent shell buttons use declarative actions and retain first-install offline behavior',()=>{
 const shell=readFileSync(new URL('../partials/shell.html',import.meta.url),'utf8');
 const boot=readFileSync(new URL('../partials/boot.html',import.meta.url),'utf8');
 const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 const chrome=shell.slice(0,shell.indexOf('id="v-dash"'));
 assert.doesNotMatch(chrome,/\bon(?:click|change|input|submit)\s*=/i);
 assert.equal((chrome.match(/data-dg-chrome-action=/g)||[]).length,3);
 assert.match(boot,/src\/ui\/shell-chrome-actions\.js/);
 assert.match(sw,/\/src\/ui\/shell-chrome-actions\.js/);
 const install=sw.match(/const INSTALL_ASSETS = \[([\s\S]*?)\];/)[1];
 assert.match(install,/\/src\/ui\/shell-chrome-actions\.js/);
});
