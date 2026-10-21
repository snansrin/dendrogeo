import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {parse} from 'acorn';
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

test('Turkish runtime presentation has no remaining Waypoint labels; technical names are preserved',()=>{
 const failures=[];
 function visible(value){
  const text=value.replace(/<[^>]*(?:>|$)/g,'').trim();
  return /\bwaypoint(?:s)?\b/i.test(text)&&! /^(?:[.#\[]|[a-z0-9_.\/-]+$)/.test(text);
 }
 function walk(node,file){
  if(!node||typeof node!=='object')return;
  const text=node.type==='Literal'&&typeof node.value==='string'?node.value:node.type==='TemplateElement'?node.value.cooked:null;
  if(text&&visible(text))failures.push(file+': '+text.slice(0,100));
  for(const[key,value]of Object.entries(node)){if(['start','end'].includes(key))continue;if(Array.isArray(value))value.forEach(child=>walk(child,file));else walk(value,file);}
 }
 function scan(directory){for(const entry of readdirSync(new URL('../'+directory+'/',import.meta.url),{withFileTypes:true})){
  const path=directory+'/'+entry.name;if(entry.isDirectory()){if(entry.name!=='bootstrap')scan(path);continue;}
  if(!path.endsWith('.js')||path==='src/config/i18n-en.js')continue;
  walk(parse(read(path),{ecmaVersion:'latest',sourceType:'script'}),path);
 }}
 scan('src');
 for(const path of ['partials/landing.html','partials/shell.html','kullanim-kosullari/index.html']){
  const html=read(path).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<!--[\s\S]*?-->/g,'');
  if(visible(html.replace(/<[^>]*>/g,' ')))failures.push(path);
 }
 assert.deepEqual(failures,[]);
 assert.match(read('src/ui/waypoint-actions.js'),/\[data-dg-waypoint-action\]/);
 assert.match(read('src/ui/waypoint-list.js'),/\[data-waypoint-action\]/);
 assert.match(read('src/adapters/parks/upsert-project-waypoint.js'),/"waypoints"/);
});

test('new Turkish menu and feedback labels retain English translations and Turkish round trips',()=>{
 const context=vm.createContext({window:{},localStorage:{getItem:()=>null},document:{addEventListener(){},querySelectorAll:()=>[],documentElement:{}},setTimeout(){}});
 vm.runInContext(read('src/config/i18n-en.js'),context);
 vm.runInContext(read('src/config/i18n.js'),context);
 assert.deepEqual(Array.from(vm.runInContext('Object.keys(DG_I18N_EN).filter(key=>/\\bwaypoint(?:s)?\\b/i.test(key))',context)),[]);
 for(const label of ['Grid & Ölçüm noktaları','Ölçüm noktaları','Bekleyen ölçüm noktası kalmadı.','Ölçüm noktası listesi alınamadı:']){
  const english=vm.runInContext(`DG_LANG='en';dgT(${JSON.stringify(label)})`,context);
  assert.notEqual(english,label);
  assert.equal(vm.runInContext(`DG_LANG='tr';dgT(${JSON.stringify(english)})`,context),label);
 }
});
