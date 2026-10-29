import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
function setup(){
 const context=vm.createContext({console,document:{readyState:'loading',addEventListener(){},documentElement:{lang:'tr'}},localStorage:{getItem:()=>null}});
 vm.runInContext('window=globalThis',context);
 for(const path of ['src/config/i18n-en.js','src/config/i18n.js',...['render-surface-export-infographic','gis-export-verified-frame','gis-export-verified-summary','gis-export-canvas-legend','gis-export-standard-canvas','park-export-canvas'].map(p=>'src/ui/'+p+'.js')])vm.runInContext(read(path),context,{filename:path});
 return context;
}
function recorder(){
 const text=[],geometry=[];
 const context=new Proxy({fillText:(value,...args)=>text.push([value,...args]),measureText:value=>({width:String(value).length*7})},{get(target,key){return key in target?target[key]:(...args)=>geometry.push([key,...args]);}});
 return {context,text,geometry};
}
test('EN/TR canvas exports translate labels at draw time and preserve names, areas and drawing operations',()=>{
 const w=setup(),areas={green:220376.1917,hard:140542.2600,water:120078.2176,building:18475.6452,bare:759.5952},before=JSON.stringify(areas);
 function draw(lang){
  vm.runInContext(`DG_LANG='${lang}';document.documentElement.lang='${lang}'`,w);
  const r=recorder(),g=r.context;
  w.DG_RENDER_SURFACE_EXPORT_INFOGRAPHIC.render({context:g,width:1240,height:1560,green:'#14532d',muted:'#555',ink:'#111',colors:{},park:{name:'Yeşil alan Parkı'},parkDate:'2026-10-29',viewLabel:'ÖNİZLEME · HENÜZ KAYDEDİLMEDİ',mapTitle:'PARK ANALİZİ ÖNİZLEMESİ',areasTitle:'ANALİZ ALANLARI',footerNote:'Kabul edilmemiş analiz önizlemesi; saha doğrulaması değildir.',parkAreaLabel:'50.023',layers:{surface:true,park:true,grid:true,waypoints:true},areas,ha:n=>(n/10000).toFixed(3),labelForClass:k=>({green:'Yeşil alan',hard:'Sert zemin',water:'Su',building:'Bina',bare:'Çıplak zemin'}[k]),fingerprint:'abcd1234'});
  w.DG_GIS_EXPORT_VERIFIED_FRAME.drawHeader({g,CW:1240,CH:1560,parkName:'Yeşil alan Parkı',sensitivity:{editing:true}});
  w.DG_GIS_EXPORT_VERIFIED_FRAME.drawFooter({g,CW:1240,CH:1560,record:{fingerprint:'abcd1234'}});
  w.DG_GIS_EXPORT_VERIFIED_SUMMARY.draw({g,CW:1240,parkHa:50.023,areas,layers:{surface:true},tiers:{count:9,eligible:12,cutoffs:[.2,.4],tiers:new Map([['a','sparse'],['b','moderate'],['c','dense']])},classes:{building:{label:'Bina'}},getSurfaceTypes:()=>({green:{label:'Yeşil alan'},hard:{label:'Sert zemin'},water:{label:'Su'},bare:{label:'Çıplak zemin'}}),formatArea:n=>n.toFixed(3),color:()=> '#aaa'});
  w.DG_GIS_EXPORT_CANVAS_LEGEND.drawLegend(g,{width:1240,height:1560,pad:40,legend:250,ndvi:true,tiers:{count:9,eligible:12,cutoffs:[.2,.4],tiers:new Map([['a','sparse']])},classes:{},vegetationColors:{},format:String});
  return r;
 }
 const tr=draw('tr'),en=draw('en'),back=draw('tr'),texts=en.text.map(v=>String(v[0]));
 assert.ok(texts.includes('PARK ANALYSIS PREVIEW'));assert.ok(texts.includes('ANALYSIS AREAS'));assert.ok(texts.includes('Green area'));assert.ok(texts.includes('Buildings'));assert.ok(texts.includes('✓ Measurement points'));assert.ok(texts.includes('✓ Park area'));assert.ok(texts.includes('Bare ground'));assert.ok(texts.includes('Eligible cells: 9 / 12'));assert.ok(texts.includes('Sparse: 1 cells'));
 assert.ok(texts.some(v=>v.includes('Yeşil alan Parkı')&&v.includes('PREVIEW')),'user names stay original');
 assert.ok(texts.includes('22.038 ha'));assert.ok(texts.includes('50.023 ha'));assert.ok(texts.some(v=>v.includes('abcd1234')&&v.includes('CC BY-NC 4.0')));
 assert.ok(!texts.some(v=>/DOĞRULANMIŞ|ÖNİZLEME|Sert zemin|Çıplak zemin|hücre|parmak izi/.test(v)));
 assert.deepEqual(en.geometry,tr.geometry);assert.deepEqual(back.text,tr.text);assert.equal(JSON.stringify(areas),before);
});
test('standard and legacy park exports translate both rendered and measured legend labels',()=>{
 const w=setup();vm.runInContext("DG_LANG='en';document.documentElement.lang='en'",w);
 const r=recorder(),g=r.context;
 w.DG_GIS_EXPORT_STANDARD_LAYERS={draw:()=>({count:0})};
 w.DG_GIS_EXPORT_STANDARD_CANVAS.draw({context:g,layout:{W:1240,H:1560,PAD:40,LEGEND:250},options:{},ndvi:true,parkName:'Göksu Parkı',canvasApi:{drawLegend(){}},classMap:{}});
 w.DG_PARK_EXPORT_CANVAS.draw({context:g,layout:{W:1240,H:900,PAD:40,LEGH:150,scale:1,projector:{X:x=>x,Y:y=>y}},options:{cover:true},landcover:{patches:[{classKey:'green',rings:[]}]},outer:[],holes:[],classes:()=>[{key:'green',label:'Yeşil alan',color:'#aaa'}],areaM2:()=>500231.9,osmAttribution:()=> '© OpenStreetMap contributors',traceRing(){}});
 const texts=r.text.map(v=>String(v[0]));assert.ok(texts.includes('DendroGeo · Verified Map'));assert.ok(texts.includes('DendroGeo · Park Analysis'));assert.ok(texts.includes('Green area'));assert.ok(texts.some(v=>v.includes('Relative NDVI enabled')));assert.ok(texts.some(v=>v.startsWith('Park polygon: 50.02 ha')));assert.ok(texts.some(v=>v.includes('Park boundary and data:')));assert.ok(!texts.some(v=>/Türk|Katmanlar|polygonu|Doğrulanmış/.test(v)));
});
