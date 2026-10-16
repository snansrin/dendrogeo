import {test} from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
import {packageApplication} from '../scripts/lib/app-runtime-package.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const modules=['src/domain/settings/appearance-policy.js','src/adapters/settings/appearance-preference.js','src/ui/appearance.js'];
test('appearance policy handles invalid preferences and system changes',()=>{
 const window={};vm.runInNewContext(read(modules[0]),{window});const policy=window.DG_APPEARANCE_POLICY;
 for(const value of [null,'invalid',{},undefined])assert.equal(policy.normalize(value),'system');
 assert.equal(policy.resolve('system',true),'dark');assert.equal(policy.resolve('system',false),'light');assert.equal(policy.resolve('light',true),'light');assert.equal(policy.resolve('dark',false),'dark');
});
test('blocked storage does not break startup or preference selection',()=>{
 const window={localStorage:{getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}}};
 for(const file of modules)vm.runInNewContext(read(file),{window});
 assert.equal(window.DG_APPEARANCE_PREFERENCE.read(),null);assert.equal(window.DG_APPEARANCE.set('dark'),false);assert.equal(window.DG_APPEARANCE.state().theme,'dark');
});
test('eager theme modules retain native execution before runtime and are cached',()=>{
 const html=modules.map(path=>'<script src="'+path+'" data-dg-eager></script>').join('')+'<script src="src/ui/other.js" defer></script>';
 const calls=[],packaged=packageApplication(html,path=>{calls.push(path);return '';});assert.deepEqual(calls,['src/ui/other.js']);
 for(const file of modules){assert.ok(packaged.manifest.includes('src="'+file+'" data-dg-eager'));assert.ok(read('sw.js').includes("'/"+file+"'"));}
 assert.ok(read('partials/head.html').indexOf(modules[2])<read('partials/head.html').indexOf('css/style.css'));
 const installed=read('sw.js').match(/const INSTALL_ASSETS = \[([\s\S]*?)\];/)[1];
 for(const file of [...modules,'css/appearance.css'])assert.ok(installed.includes("'/"+file+"'"),file+' must be available on the first offline visit');
});
test('personal panel has appearance settings and no report link or scientific wording',()=>{
 const source=read('src/ui/render-academic-profile.js');assert.ok(source.includes('data-dg-dark-mode'));assert.ok(source.includes('data-dg-theme-system'));
 assert.doesNotMatch(source,/href="rapor\/"|bilimsel|Akademik bilgilerimi/i);
 assert.ok(read('partials/shell.html').includes('data-personal-summary'));
 assert.doesNotMatch(read('css/appearance.css'),/filter\s*:/);
});
