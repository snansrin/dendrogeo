import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const file=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const adapter=file('src/ui/gis-export.js'),style=file('css/gis-workspace.css'),ui=file('src/ui/gis-workspace.js');
const lock=JSON.parse(file('docs/surface-engine-lock.json'));
function env({ndvi=false,ndviAvailable=true,gridCells=[]}={}){
 const messages=[],ops=[],downloads=[],elements={},polygon=[
  [{lat:39.99,lng:32.64},{lat:39.99,lng:32.66},{lat:40.01,lng:32.66},{lat:40.01,lng:32.64}]
 ];
 const ctx={
  window:{DG_LANDCOVER:{getLast:()=>({report:{patches:[{group:'water',rings:[[[39.99,32.64],[39.99,32.66],[40.01,32.66],[40.01,32.64]]] }]}})},
   DG_LC_SENS:{state:{vegetationView:ndvi,rawView:false,opacity:65,displayPaths:[],
    vegetationLayer:{eachLayer:fn=>{if(ndviAvailable)fn({getLatLngs:()=>polygon,options:{fillColor:'#047857'}})}}}}},
  DG_LC_CLASSES:[{key:'water',color:'#3b82f6',label:'Su'}],
  DG_SENS_VEGETATION_COLORS:{sparse:'#fde68a',moderate:'#4ade80',dense:'#166534'},
  dgSensVegetationTiers:()=>({count:ndviAvailable?12:0}),
  dgSensRenderVegetation:async()=>{},
  PARK_POLY:[[[39.99,32.64],[39.99,32.66],[40.01,32.66],[40.01,32.64]]],
  PARK_HOLES:[],DG_GRID_SESSION:{getCells:()=>gridCells},WP:[],DG_PARK:{name:'Göksu Parkı'},
  toast:(m,type)=>messages.push([m,type]),
  document:{getElementById:id=>elements[id]||null,body:{append:()=>{}},createElement:tag=>{
   if(tag==='canvas')return {width:0,height:0,
    getContext:()=>({beginPath:()=>{},moveTo:()=>{},lineTo:()=>{},closePath:()=>{},
      fill:()=>ops.push('fill'),fillRect:()=>{},strokeRect:()=>ops.push('grid'),stroke:()=>{},setLineDash:()=>{},
      fillText:()=>{},arc:()=>{},save:()=>{},restore:()=>{},clip:()=>{},measureText:()=>({width:20})}),
    toBlob:cb=>cb({size:1024})};
   if(tag==='a')return {click:()=>downloads.push('click'),remove:()=>{},set href(v){},set download(v){downloads.push(v)}};
   throw Error('Unknown tag '+tag);
  }},
  URL:{createObjectURL:()=> 'blob:demo',revokeObjectURL:()=>{}},
  setTimeout,clearTimeout,console,Date,Math,Array,Number,Promise,Intl
 };
 vm.createContext(ctx);
 vm.runInContext(adapter,ctx,{filename:'gis-export.js'});
 return {ctx,messages,ops,downloads};
}
test('PNG adapter is outside frozen scientific engine and does not mutate review state',()=>{
 assert.ok(!lock.locked_files['src/ui/gis-export.js']);
 assert.ok(lock.locked_files['src/ui/park-export.js']);
 assert.ok(lock.locked_files['src/ui/lc-sens.js']);
 assert.match(adapter,/window\.downloadParkImage=exportMap/);
 assert.doesNotMatch(adapter,/dgSensSave\(|dgSensAccept\(|DG_LC_LAST\s*=|sb\.from\(/);
 assert.doesNotThrow(()=>new vm.Script(adapter));
});
test('PNG classes are resolved at click time after lazy engine loads, never frozen at startup',()=>{
 const {ctx,downloads}=env();
 const classes=ctx.window.DG_GIS_PNG_EXPORT.classes();
 assert.equal(classes.water.color,'#3b82f6');
 return ctx.window.downloadParkImage().then(ok=>{
  assert.equal(ok,true);assert.ok(downloads.some(x=>/\.png$/.test(x)));
 });
});
test('Relative NDVI ON includes real polygon layer in verified export',async()=>{
 const {ctx,downloads,ops}=env({ndvi:true});
 assert.equal(await ctx.window.downloadParkImage(),true);
 assert.ok(downloads.some(x=>/goreli_ndvi.*\.png/.test(x)));
 assert.ok(ops.length>=2,'raw surface plus NDVI fill should both render');
});
test('Missing NDVI observations do not pretend that green NDVI imagery was exported',async()=>{
 const {ctx,downloads,messages}=env({ndvi:true,ndviAvailable:false});
 assert.equal(await ctx.window.downloadParkImage(),false);
 assert.equal(downloads.length,0);
 assert.match(messages[0][0],/NDVI/);
});
test('surface scan presentation shows one current summary; raw report remains available on demand',()=>{
 const sens=file('src/ui/lc-sens.js');
 assert.match(sens,/dgSensRenderCurrentReport/);
 assert.match(sens,/dgSensRawView/);
 assert.match(style,/#v-map\.surface-review-active #landCoverReport>details\.dg-sens-details/);
 assert.match(style,/display:none!important/);
 assert.match(style,/#v-map #landCoverReport>\.dg-surface-stat/);
 assert.doesNotMatch(ui,/dgSensScan\(|dgSensAreas\(|dgSensSave\(/);
});
test('mobile overflow and toast layer are addressed without changing locked CSS or class colors',()=>{
 assert.match(style,/#v-map #parkInfo #parkSurfaceAction>\.dg-png-sub:last-child/);
 assert.match(style, /overflow-wrap:anywhere/);
 assert.match(style, /#toastWrap\{/);
 assert.match(style, /z-index:2147483000!important/);
 assert.match(style, /@media\(max-width:360px\)/);
 assert.match(style, /#v-map #lcSens \.dg-sens-actions/);
 assert.match(ui,/dg-ux-group-summary/);
 const mobile=style.slice(style.indexOf('/* Oct 2026 mobile polish'));
 assert.match(mobile,/#toastWrap\{[\s\S]*?top:max\(12px,env\(safe-area-inset-top\) \+ 12px\)!important/);
 assert.match(mobile,/#toastWrap\{[\s\S]*?bottom:auto!important/);
 assert.match(mobile,/#parkSurfaceAction>\.dg-png-btn\{[\s\S]*?white-space:normal/);
 assert.match(mobile,/#parkSurfaceAction>\.dg-png-head\{[\s\S]*?grid-template-columns:minmax\(0,1fr\)/);
});
test('boot, SW and index will expose PNG adapter after locked exporter',()=>{
 const boot=file('partials/boot.html'),sw=file('sw.js'),index=file('index.html');
 assert.match(boot,/src\/ui\/gis-export\.js\?v=[a-f0-9]{8}/);
 assert.match(index,/src\/ui\/gis-export\.js\?v=[a-f0-9]{8}/);
 assert.match(sw,/\/src\/ui\/gis-export\.js/);
 assert.ok(index.indexOf('src/ui/park-export.js')<index.indexOf('src/ui/gis-export.js'));
});
test('PNG reads current session cells at export time and skips invalid cell bounds',async()=>{const cells=[];const {ctx,ops}=env({gridCells:cells});cells.push({w0:32.645,w1:32.65,s0:39.995,s1:40.0},{w0:NaN,w1:32.65,s0:39.995,s1:40.0});assert.equal(await ctx.window.downloadParkImage(),true);const baseline=env();assert.equal(await baseline.ctx.window.downloadParkImage(),true);assert.equal(ops.filter(x=>x==='grid').length-baseline.ops.filter(x=>x==='grid').length,1);});
test('PNG remains available when the optional grid session is absent',async()=>{const {ctx}=env();delete ctx.DG_GRID_SESSION;assert.equal(await ctx.window.downloadParkImage(),true);});
