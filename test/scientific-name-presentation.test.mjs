import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('scientific name styling preserves existing inline species selector labels',()=>{
 const selector=read('src/ui/measurement-species-selector.js');
 assert.ok(selector.includes('" · "+item.lat'));
 assert.match(read('css/style.css'),/\.dg-latin-name,#latinName\{font-style:italic\}/);
 assert.ok(read('src/ui/scientific-species-select.js').includes('latin.className="dg-latin-name"'));
 for(const path of ['src/ui/admin-tree-measurement-row.js','src/ui/admin-measurement-row.js']){
  const source=read(path);assert.match(source,/<span class="mono(?: dg-sub)? dg-latin-name" lang="la"[^>]*>\$\{[^}]*latin/);
 }
 assert.ok(!read('src/ui/admin-tree-measurement-row.js').includes('lang="la"> /M'));
});
