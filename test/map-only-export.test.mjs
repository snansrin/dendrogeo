import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
function load(paths,window={}){for(const path of paths)vm.runInNewContext(readFileSync(new URL('../'+path,import.meta.url),'utf8'),{window,Date,setTimeout:fn=>fn(),URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}}});return window;}
const exporter='src/ui/render-verified-surface-map-export.js';
function fixture(){
 const texts=[],files=[],notices=[],order=[],state={epoch:1,geometry:{},epsg:32636,base:'sat'},record={acceptedAt:null,features:[],corrections:{}},areas={green:10000};
 const context={fillRect(){},strokeRect(){},fillText:text=>texts.push(text)};
 const canvas={getContext:()=>context,toBlob:fn=>fn({})};
 const args={layers:{park:true,surface:false,mapOnly:true,boundaryColor:'#ff0000'},state,record,cells:[{}],editSummary:()=>({total:0}),toast:msg=>notices.push(msg),translate:String,escape:String,getAreas:()=>areas,getParkRings:()=>[[[40,32],[40.01,32],[40,32.01]]],getGridCells:()=>[],getPark:()=>({id:49}),getParts:()=>assert.fail('disabled surface must not request display geometry'),visualResult:()=>assert.fail(),prepareFrame:()=>({canvasProject:()=>[0,0]}),drawLayers:()=>order.push('layers'),renderInfo:()=>assert.fail('map only must omit report'),document:{createElement:kind=>kind==='canvas'?canvas:{click(){files.push(this.download);}}},redraw(){}};
 return{args,texts,files,notices,order,canvas,context};
}
test('map-only PNG waits for basemap, omits report, and preserves all inputs',async()=>{
 const f=fixture(),before=JSON.stringify([f.args.record,f.args.state,f.args.getAreas()]);
 const window=load([exporter],{DG_DRAW_SURFACE_EXPORT_BASEMAP:{async draw(input){assert.equal(input.base,'sat');assert.equal(input.rect.width,1240);f.order.push('basemap');return 'Tiles © Esri';}}});
 await window.DG_RENDER_VERIFIED_SURFACE_MAP_EXPORT.render(f.args);
 assert.deepEqual(f.order,['basemap','layers']);assert.deepEqual(f.files,['dendrogeo_harita_49.png']);assert.deepEqual(f.texts,['© DendroGeo · dendrogeo.org','Tiles © Esri']);assert.equal(f.canvas.height,1240);
 assert.equal(JSON.stringify([f.args.record,f.args.state,f.args.getAreas()]),before.replace('"base":"sat"','"base":"sat","exporting":false'));
});
test('failed basemap refuses a blank download and releases busy state',async()=>{
 const f=fixture(),window=load([exporter],{DG_DRAW_SURFACE_EXPORT_BASEMAP:{async draw(){throw Error('Tile unavailable');}}});
 await window.DG_RENDER_VERIFIED_SURFACE_MAP_EXPORT.render(f.args);
 assert.deepEqual(f.files,[]);assert.deepEqual(f.order,[]);assert.deepEqual(f.notices,['Tile unavailable']);assert.equal(f.args.state.exporting,false);
});
test('park outline uses chosen color with a safe fallback and does not mutate geometry',()=>{
 const window=load(['src/ui/draw-surface-export-map-layers.js']),strokes=[],context={save(){},restore(){},clip(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},stroke(){strokes.push(this.strokeStyle);}},rings=[[[40,32],[40.01,32],[40,32.01]]],before=JSON.stringify(rings);
 for(const boundaryColor of ['#ff0000','invalid'])window.DG_DRAW_SURFACE_EXPORT_MAP_LAYERS.draw({context,layers:{park:true,boundaryColor},project:(lat,lon)=>[lon,lat],parkRings:rings});
 assert.deepEqual(strokes,['#ff0000','#111827']);assert.equal(JSON.stringify(rings),before);
});
test('NDVI bridge leaves map-only download to its own renderer and forwards report outline color',()=>{
 let handler,captured;const window=load(['src/ui/gis-export-events.js'],{DG_LC_SENS:{state:{vegetationView:true}}});
 window.DG_GIS_EXPORT_EVENTS.bind({document:{addEventListener:(_name,fn)=>handler=fn},window,exportVerified:layers=>captured=layers});
 let only=true;const dialog={id:'dgSurfaceExportDialog',querySelector:q=>q.includes('mapOnly')?{checked:only}:q.includes('boundaryColor')?{value:'#ff0000'}:{checked:true},close(){}};
 const event={target:{closest:q=>q==='#dgExportDownload'?{closest:()=>dialog}:null},preventDefault(){},stopImmediatePropagation(){}};
 handler(event);assert.equal(captured,undefined);only=false;handler(event);assert.equal(captured.boundaryColor,'#ff0000');
});
