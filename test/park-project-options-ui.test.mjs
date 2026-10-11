import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const context={window:{}};
vm.createContext(context);
vm.runInContext(readFileSync(new URL('../src/ui/park-project-options.js',import.meta.url),'utf8'),context);
const ui=context.window.DG_PARK_PROJECT_OPTIONS_UI;
const projects=[
  {id:1,name:'Göksu <deneme>',park_id:7},
  {id:2,name:'Eski Proje',park_id:null},
  {id:3,name:'Kuğulu',park_id:8}
];
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');

test('park project option labels preserve linked and unlinked markers',()=>{
  assert.equal(ui.label(projects[0]),'Göksu <deneme>');
  assert.equal(ui.label(projects[1]),'⛔ Eski Proje (park yok)');
  assert.equal(ui.label(null),'');
});

test('park project options scope by park and escape names',()=>{
  assert.equal(ui.forPark({parkId:7,projects,escape}),'<option value="1">Göksu &lt;deneme&gt;</option>');
});

test('legacy fallback and empty-project guidance stay intact',()=>{
  assert.ok(ui.forPark({parkId:999,fallbackAll:true,projects,escape}).includes('Eski Proje'));
  assert.equal(ui.forPark({parkId:999,fallbackAll:false,projects,escape}),'<option value="0">Bu park için proje yok — algılama kartından oluştur</option>');
});
