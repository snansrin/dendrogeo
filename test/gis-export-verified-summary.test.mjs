import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

test('verified summary renders the supplied area and NDVI values unchanged',()=>{
 const source=readFileSync(new URL('../src/ui/gis-export-verified-summary.js',import.meta.url),'utf8');
 const labels=[];
 const g={fillText:text=>labels.push(String(text)),fillRect:()=>{},beginPath:()=>{},moveTo:()=>{},lineTo:()=>{},stroke:()=>{}};
 const context={window:{}};
 vm.createContext(context);
 vm.runInContext(source,context);
 context.window.DG_GIS_EXPORT_VERIFIED_SUMMARY.draw({
  g,CW:1240,parkHa:12.34,areas:{green:12500,water:0,hard:2500},
  layers:{surface:true},tiers:{count:9,eligible:12,cutoffs:[.2,.4],tiers:new Map([
   ['a','sparse'],['b','sparse'],['c','moderate'],['d','moderate'],['e','moderate'],
   ['f','dense'],['g','dense'],['h','dense'],['i','dense']
  ])},classes:{},getSurfaceTypes:()=>({green:{label:'Yeşil'},hard:{label:'Sert zemin'}}),
  formatArea:value=>value.toFixed(2),color:key=>key
 });
 assert.ok(labels.includes('12.3 ha'));
 assert.ok(labels.includes('PARK ALANI ÖZETİ'));
 assert.ok(labels.includes('Yeşil'));
 assert.ok(labels.includes('1.25 ha'));
 assert.ok(labels.includes('0.25 ha'));
 assert.ok(labels.includes('Seyrek: 2 hücre'));
 assert.ok(labels.includes('Orta: 3 hücre'));
 assert.ok(labels.includes('Yoğun: 4 hücre'));
 assert.ok(labels.includes('Uygun hücre: 9 / 12'));
 assert.ok(labels.includes('Eşikler: 0.200 / 0.400'));
 assert.ok(!labels.some(label=>/karar|kabul edilen/i.test(label)));
 assert.ok(!labels.includes('KULLANICI DÜZENLEMESİ'));
});
