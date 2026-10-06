import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT=join(dirname(fileURLToPath(import.meta.url)),'..');
const rd=p=>readFileSync(join(ROOT,p),'utf8');

test('Dışa Aktar başlığında yöntem rozeti yok; paneller ortak details temasında',()=>{
 const shell=rd('partials/shell.html');
 assert.ok(!shell.includes('C → DBH = C/π · DBH 0,1 cm'));
 assert.match(shell,/class="export-panel"/);
 assert.match(shell,/class="export-format-grid"/);
});

test('Kayıtlarım proje bazında kapalı disclosure olarak gruplanır',()=>{
 const dash=rd('src/services/dash.js');
 assert.match(dash,/return `<details class="record-project">/);
 assert.ok(!dash.includes('index===0?"open":""'));
 assert.match(rd('partials/shell.html'),/id="recGroups" class="records-groups"/);
});

test('Waypoint görünümünde yalnız harita açılır-kapanır; diğer saha araçları açık kalır',()=>{
 const shell=rd('partials/shell.html');
 const a=shell.indexOf('<div class="view" id="v-nav">');
 const b=shell.indexOf('<div class="view"',a+30);
 const nav=shell.slice(a,b);
 assert.equal((nav.match(/<details\b/g)||[]).length,1);
 assert.match(nav,/id="wpMapPanel" class="card waypoint-map"/);
 assert.match(nav,/class="waypoint-files"/);
 assert.ok(!/class="waypoint-files"[^>]*><summary/.test(nav));
});

test('Taleplerim kapalı disclosure olur ve kullanıcı kendi talebini silebilir',()=>{
 const req=rd('src/services/data-requests.js');
 assert.match(req,/class="export-my-requests"/);
 assert.match(req,/async function deleteMyRequest\(id\)/);
 assert.match(req,/\.delete\(\)\.eq\("id",\+id\)\.eq\("user_id",USER\.id\)/);
 const mig=rd('supabase/migrations/20261006193500_data_requests_delete_own.sql');
 assert.match(mig,/for delete\s+to authenticated/i);
 assert.match(mig,/auth\.uid\(\).*user_id/s);
});

test('landing hero yalnız yuvarlanmış DBHyi gösterir; yöntem kaynağı gizli test verisinde korunur',()=>{
 const landing=rd('partials/landing.html'),css=rd('css/landing.css');
 assert.match(landing,/class="chip c1" data-circumference="45"[^>]*>[\s\S]*?DBH 14\.3 cm/);
 assert.ok(!landing.includes('ÇEVRE 45 cm → DBH 14.3 cm'));
 assert.match(css,/\.chip\.c1\{top:38%/);
 assert.match(css,/\.chip\.c3\{top:42%/);
});

test('yayın öncesi form gerekli alanlarda örnek yardım balonları taşır',()=>{
 const p=rd('src/services/academic-profile.js'),css=rd('css/academic-profile.css');
 for(const key of ['author_name','project_name','title','advisor','purpose','sampling','instruments'])assert.match(p,new RegExp(key+':'));
 assert.match(p,/class="dg-field-help"/);
 assert.match(p,/data-tip=/);
 assert.match(css,/\.dg-field-help:hover::after/);
 assert.match(css,/\.dg-field-help:focus::after/);
});

test('bilimsel yöntem her ana belgede çevre bölü pi ve DBH 0,1 cm gösterimini beyan eder',()=>{
 for(const p of ['README.md','docs/methods.md','yontem/index.html','agac-envanteri/index.html','karbon-hesaplama/index.html']){
  const t=rd(p);
  assert.match(t,/C\s*\/\s*π|D\s*=\s*C\s*\/\s*π|çevre\s*÷\s*π/i,p);
  assert.match(t,/1 ondalık|0,1 cm/i,p);
 }
});
