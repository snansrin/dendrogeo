import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('measurement-points screen has Turkish labels and English translations with unchanged routes and controls',()=>{
 const shell=read('partials/shell.html'),context=vm.createContext({window:{}});
 vm.runInContext(read('src/config/i18n-en.js'),context);
 assert.match(shell,/data-dg-view="nav">🧭 Ölçüm noktaları<\/div>/);
 assert.match(shell,/<h2 class="disp">Ölçüm noktaları<\/h2>/);
 assert.match(shell,/id="waypointListTitle">Ölçüm noktaları listesi<\/h3>/);
 assert.match(shell,/id="nCsv"/);
 assert.match(shell,/id="nProject" data-dg-waypoint-action="load"/);
 for(const key of ['Ölçüm noktaları','🧭 Ölçüm noktaları','📍 Ölçüm noktaları','Ölçüm noktaları listesi','Ölçüm noktaları dosyası']){
  assert.ok(vm.runInContext(`DG_I18N_EN[${JSON.stringify(key)}]`,context),key);
 }
});
