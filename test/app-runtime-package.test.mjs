import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {packageApplication} from '../scripts/lib/app-runtime-package.mjs';

test('runtime packaging preserves native classic-script lexical scope and source order',()=>{
 const sources={'src/first.js':'window.before=typeof later;let first=3;', 'src/second.js':'let later=4;window.total=first+later;'};
 const html='<script src="vendor/library.js" defer></script><script src="src/first.js?v=a" defer></script><script src="src/second.js?v=b" defer></script>';
 const result=packageApplication(html,path=>sources[path]);
 const context=vm.createContext({window:{},URL}),executed=[];
 context.document={baseURI:'https://example.test/',createElement:()=>({textContent:'',remove(){}}),head:{appendChild(script){executed.push(script.textContent);vm.runInContext(script.textContent,context);}}};
 vm.runInContext(result.runtime,context);
 assert.equal(context.window.before,'undefined');assert.equal(context.window.total,7);
 assert.equal(executed.length,2);assert.equal(result.count,2);
 assert.match(executed[0],/sourceURL=https:\/\/example.test\/src\/first.js\?v=a/);
 assert.match(result.manifest,/<script src="vendor\/library.js" defer>/);
 assert.equal((result.manifest.match(/application\/x-dendrogeo-module/g)||[]).length,2);
 assert.deepEqual(packageApplication(html,path=>sources[path]),result);
});

test('published index downloads one app package and retains original module ordering as metadata',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const tags=[...html.matchAll(/<script\s+src="([^"]+)"([^>]*)>/g)];
 const executable=tags.filter(tag=>!tag[2].includes('application/x-dendrogeo-module'));
 const eager=executable.filter(tag=>tag[2].includes('data-dg-eager'));
 assert.equal(eager.length,3);assert.equal(executable.length,4+eager.length);assert.equal(executable.filter(tag=>tag[1].includes('app-runtime.js')).length,1);
 const modules=tags.filter(tag=>tag[2].includes('application/x-dendrogeo-module'));
 assert.ok(modules.length>600);
 const inputs=['head','landing','shell','boot'].map(name=>readFileSync(new URL('../partials/'+name+'.html',import.meta.url),'utf8')).join('');
 const expected=[...inputs.matchAll(/<script\s+src="(src\/[^"?]+)([^>]*)>/g)].filter(tag=>!tag[2].includes('data-dg-eager')).map(tag=>tag[1]);
 assert.deepEqual(modules.map(tag=>tag[1].split('?')[0]),expected);
});
