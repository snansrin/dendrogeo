import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../src/ui/gis-export-compat.js',import.meta.url),'utf8');
test('verified-map PNG paints current NDVI terciles without touching approved data',async()=>{
 let listener,downloaded='',closed=0,blobbed=0,prevented=false,stopped=false;
 const paint=[];
 const graphics={
  fillStyle:'',font:'',strokeStyle:'',
  fillRect(){paint.push(this.fillStyle);},
  fill(){paint.push(this.fillStyle);},
  beginPath(){},closePath(){},moveTo(){},lineTo(){},
  stroke(){},strokeRect(){},save(){},restore(){},rect(){},clip(){},arc(){},
  fillText(){}
 };
 const canvas={width:0,height:0,getContext:()=>graphics,toBlob:fn=>{blobbed++;fn({size:2500});}};
 const dialog={
  querySelector:sel=>({checked:!sel.includes('waypoints')&&!sel.includes('grid')}),
  close(){closed++;}
 };
 const button={closest:selector=>selector==='dialog'?dialog:null};
 const body={append(){}};
 const saved={acceptedAt:'2026-10-08',serverRevision:1,fingerprint:'1234567890'};
 const coords=[[32.60,39.99],[32.61,39.99],[32.61,40.00],[32.60,40.00]];
 const cellGeometry=[[[[32600,39990],[32610,39990],[32610,40000],[32600,40000]]]];
 const tiers=new Map(Array.from({length:9},(_,i)=>[i+':0',i%3===0?'sparse':i%3===1?'moderate':'dense']));
 const sandbox={
  window:{},URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}},
  setTimeout(){},console,
  document:{
   addEventListener(type,callback){if(type==='click')listener=callback;},
   getElementById(id){return id==='gridProject'?{value:'25'}:null;},
   createElement(tag){return tag==='canvas'?canvas:{href:'',download:'',click(){downloaded=this.download;},remove(){}};},
   body
  },
  DG_SENS:{epoch:1,record:saved,vegetationView:true,geometry:Object.fromEntries([['0:0',cellGeometry]]),epsg:32636,
   busy:false,saving:false,exporting:false,editing:false},
  PARK_POLY:[coords.map(([lon,lat])=>[lat,lon])],PARK_HOLES:[],
  WP:[],LAST_WP_ROWS:[],GRID_CELLS:[],
  DG_SENS_VEGETATION_COLORS:{sparse:'#b7e4a8',moderate:'#4caf66',dense:'#14532d'},
  DG_SENS_COLORS:{green:'#22c55e',water:'#3b82f6'},
  DG_SURFACE_REVIEW:{types:{green:{label:'Yeşil alan'}}},
  dgSensCells:()=>[{center:{lat:39.99,lon:32.60},quadWgs:coords}],
  dgSensVegetationTiers:()=>({count:9,tiers,cutoffs:[0.30,0.55]}),
  dgSensEditSummary:()=>({total:1,manualCells:1,sensitivityCells:0,boundaries:0}),
  dgSensFeatures:()=>[{}],
  dgSensParts:()=>[],
  dgSensVisualResult:async()=>({displayFeatures:[{properties:{class:'green'},geometry:{coordinates:[[coords]]}}]}),
  dgSensAreas:()=>({green:1500,water:0,hard:0,bare:0,building:0,pool:0}),
  dgSensParkId:()=>({id:25,name:'Göksu Parkı'}),
  dgLcUtmForward:(lat,lon)=>({x:lon*1000,y:lat*1000}),
  parkAreaHa:()=>50.1,
  toast:()=>{}
 };
 vm.createContext(sandbox);vm.runInContext(source,sandbox,{timeout:1000});
 assert.equal(typeof listener,'function');
 const event={target:{closest:selector=>selector==='#dgExportDownload'?button:null},
  preventDefault(){prevented=true;},stopImmediatePropagation(){stopped=true;}};
 listener(event);
 await new Promise(resolve=>setImmediate(resolve));
 assert.ok(prevented&&stopped,'Active NDVI intercepts only verified map download');
 assert.equal(closed,1);
 assert.equal(blobbed,1);
 assert.match(downloaded,/dendrogeo_dogrulanmis_harita_ndvi_25.png/);
 assert.ok(paint.includes('#b7e4a8'),'Relative sparse-NDVI cells must be colored in the output');
 assert.equal(saved.fingerprint,'1234567890','Accepted input metadata was untouched');
 sandbox.DG_SENS.vegetationView=false;prevented=false;stopped=false;
 listener(event);
 assert.equal(prevented,false,'Inactive NDVI leaves frozen default exporter untouched');
 assert.equal(stopped,false);
});
