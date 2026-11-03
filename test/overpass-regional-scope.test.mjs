import {test} from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
test('regional OSM source is eligible only for bounded queries wholly inside its supported scope',()=>{
 const c=vm.createContext({window:{}});vm.runInContext(readFileSync(new URL('../src/domain/parks/select-overpass-mirrors.js',import.meta.url),'utf8'),c);
 const api=c.window.DG_SELECT_OVERPASS_MIRRORS,urls=['https://overpass-api.de/api/interpreter'];
 assert.equal(api.forQuery('way(51.5,-.17,51.6,-.15);',urls).length,1);
 const eligible=api.forQuery('way(51.5,-0.17,51.6,-0.15);',urls);assert.equal(eligible.length,2);assert.match(eligible[0],/dresel/);
 assert.equal(api.forQuery('way(39,32,40,33);',urls),urls);
 assert.equal(api.forQuery('way(51.5,-0.17,51.6,-0.15);way(39,32,40,33);',urls),urls);
 assert.equal(api.forQuery('way(372975520);',urls),urls);
 assert.equal(api.forQuery('way(around:1200,51.5,-0.17);',urls).length,2);
 const health=new Map([[eligible[0],{badUntil:1000}]]);assert.equal(api.select(eligible,health,0).length,1);
});
