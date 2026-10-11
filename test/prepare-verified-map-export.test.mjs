import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/application/surface/prepare-verified-map-export.js',import.meta.url),'utf8');
const context=vm.createContext({window:{}});
vm.runInContext(source,context);
const prepare=context.window.DG_PREPARE_VERIFIED_MAP_EXPORT.prepare;
const goodTiers={count:9,cutoffs:[.2,.4]};

test('verified map gate requires analysis, park, relative NDVI, and eligible observed cells',()=>{
 const valid={record:{id:1},hasPark:true,vegetationView:true,rawView:false,getTiers:()=>goodTiers};
 const allowed=prepare(valid);
 assert.equal(allowed.ok,true);
 assert.equal(allowed.tiers,goodTiers);
 assert.equal(prepare({...valid,record:null}).message,'Önce parkın arazi örtüsü analizini açın.');
 assert.equal(prepare({...valid,hasPark:false}).message,'Önce parkın arazi örtüsü analizini açın.');
 assert.equal(prepare({...valid,vegetationView:false}).message,'Göreli NDVI görünümü açık değil.');
 assert.equal(prepare({...valid,rawView:true}).message,'Göreli NDVI görünümü açık değil.');
 assert.equal(prepare({...valid,getTiers:null}).message,'Göreli NDVI sınıfları bu oturumda bulunamadı.');
 assert.equal(prepare({...valid,getTiers:()=>({count:8,cutoffs:[.2,.4]})}).message,'Doğrulanmış harita için yeterli NDVI verisi bulunamadı; en az 9 uygun yeşil hücre ve hücre başına 3 gözlem gerekir.');
 assert.equal(prepare({...valid,getTiers:()=>({count:9,cutoffs:null})}).ok,false);
});

test('failed early gates do not calculate NDVI tiers',()=>{
 let reads=0;
 const result=prepare({record:null,hasPark:false,vegetationView:false,rawView:true,getTiers:()=>{reads++;return goodTiers;}});
 assert.equal(result.ok,false);
 assert.equal(reads,0);
});

test('GIS exporter loads the gate before the adapter and service worker precaches it',()=>{
 const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 assert.ok(index.indexOf('src/application/surface/prepare-verified-map-export.js')<index.indexOf('src/ui/gis-export.js'));
 assert.match(index,/src\/application\/surface\/prepare-verified-map-export\.js\?v=[a-f0-9]{8}/);
 assert.match(sw,/\/src\/application\/surface\/prepare-verified-map-export\.js/);
});
