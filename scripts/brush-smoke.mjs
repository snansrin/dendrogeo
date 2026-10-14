import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {loadChromium} from './lib/playwright-runtime.mjs';

const root=resolve('.');
const modules=['vendor/leaflet-1.9.4.js','vendor/polygon-clipping-0.15.7.js','src/domain/surface/build-grid-line-mask.js','src/domain/surface/select-surface-brush-cells.js','src/domain/surface/create-surface-cell-decision.js','src/domain/surface/validate-surface-brush-stroke.js','src/application/surface/surface-brush-history.js','src/application/surface/commit-surface-brush-stroke.js','src/application/surface/undo-surface-brush-stroke.js','src/application/surface/select-surface-brush-type.js','src/application/surface/update-surface-brush-config.js','src/adapters/surface/surface-brush-pointer-session.js'];
const fixture=`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/vendor/leaflet-1.9.4.css"><style>body{margin:0}#map{height:650px}</style><select id="type"><option>hard</option><option>green</option><option>water</option></select><select id="size"><option>5</option><option selected>10</option><option>20</option><option>40</option></select><button id="undo">Undo</button><div class="dg-editor"><div id="map"></div></div>${modules.map(path=>'<script src="/'+path+'"></script>').join('')}<script>
const types={hard:{},green:{},water:{}},colors={hard:'#c77d2e',green:'#1e6f4b',water:'#2b6cb0'},map=L.map('map').setView([39.99,32.65],20),record={corrections:{}},state={record,epoch:1,epsg:3857,brushType:'hard',brushDiameter:10,busy:false,saving:false},cells=[],geometry={};
const origin=L.CRS.EPSG3857.project(L.latLng(39.99,32.65)),x0=origin.x-15,y0=origin.y-15;
for(let row=0;row<3;row++)for(let col=0;col<3;col++){const key=row+':'+col,x=x0+col*10,y=y0+row*10,ring=[[x,y],[x+10,y],[x+10,y+10],[x,y+10],[x,y]];geometry[key]=[[ring]];const cell={row,col,classKey:'hard'};cells.push(cell);cell.layer=L.polygon(ring.map(p=>L.CRS.EPSG3857.unproject(L.point(...p))),{color:colors.hard,fillOpacity:.7}).addTo(map);}
const park=[[[[x0,y0],[x0+30,y0],[x0+30,y0+30],[x0,y0+30],[x0,y0]]]],key=c=>c.row+':'+c.col,noop=()=>{},bounds=g=>{const p=g.flat(2);return{minX:Math.min(...p.map(p=>p[0])),minY:Math.min(...p.map(p=>p[1])),maxX:Math.max(...p.map(p=>p[0])),maxY:Math.max(...p.map(p=>p[1]))};},overlap=(a,b)=>a.maxX>b.minX&&a.minX<b.maxX&&a.maxY>b.minY&&a.minY<b.maxY;
const area=g=>g.reduce((total,poly)=>total+poly.reduce((sum,ring,index)=>sum+(index?-1:1)*Math.abs(ring.reduce((a,p,i)=>{const next=ring[(i+1)%ring.length];return a+p[0]*next[1]-next[0]*p[1];},0)/2),0),0);
const refresh=()=>cells.forEach(c=>c.layer.setStyle({color:colors[record.corrections[key(c)]?.to||c.classKey]}));
let saves=0;
const commit=(points,type,diameter)=>DG_COMMIT_SURFACE_BRUSH_STROKE.commit({points,type,diameter,state,types,allowed:[5,10,20,40],validate:DG_VALIDATE_SURFACE_BRUSH_STROKE.valid,selectCells:(points,diameter)=>DG_SURFACE_BRUSH_CELL_SELECTION.select({points,diameter,epsg:3857,polygonClipping,parkGeometry:park,geometry,cells,cellKey:key,gridLineMask:(line,epsg)=>DG_BUILD_GRID_LINE_MASK.build(line,epsg,{project:p=>p.map(([lng,lat])=>{const v=L.CRS.EPSG3857.project(L.latLng(lat,lng));return[v.x,v.y];})}),bounds,overlap,area}),cells:()=>cells,cellKey:key,createDecision:(cell,toClass,timestamp,strokeId)=>{const decision=DG_SURFACE_CELL_DECISION.create({cell,toClass,types,timestamp,strokeId,cellKey:key});if(decision)record.corrections[decision.key]=decision.decision;return decision;},appendHistory:DG_SURFACE_BRUSH_HISTORY.append,timestamp:()=>new Date().toISOString(),strokeId:()=>String(Date.now()),dirty:noop,previewCells:refresh,refresh,summary:noop,status:noop,save:async()=>{saves++;}});
const stop=()=>DG_SURFACE_BRUSH_POINTER_SESSION.stop({state,map}),toggle=()=>DG_SURFACE_BRUSH_POINTER_SESSION.start({state,map,leaflet:L,container:map.getContainer(),type:state.brushType,diameter:state.brushDiameter,colors,forward:(lat,lng)=>L.CRS.EPSG3857.project(L.latLng(lat,lng)),onCommit:commit,onError:error=>{throw error;},render:noop});
document.getElementById('type').onchange=e=>DG_SELECT_SURFACE_BRUSH_TYPE.select({state,type:e.target.value,types,stop,toggle,render:noop});
document.getElementById('size').onchange=e=>DG_UPDATE_SURFACE_BRUSH_CONFIG.update({state,type:state.brushType,size:Number(e.target.value),types,allowed:[5,10,20,40],stop,toggle,render:noop});
document.getElementById('undo').onclick=()=>DG_UNDO_SURFACE_BRUSH_STROKE.undo({record,historyModule:DG_SURFACE_BRUSH_HISTORY,dirty:noop,refresh,summary:noop,status:noop,save:noop});
window.fixtureState=()=>({active:!!state.brush,diameter:state.brush?.diameter,corrections:record.corrections,history:record.brushHistory?.length||0,raw:cells.map(c=>c.classKey),saves});
</script>`;
const server=createServer((req,res)=>{if(req.url==='/fixture'){res.setHeader('Content-Type','text/html');res.end(fixture);return;}const path=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!path.startsWith(root+'/')&&!path.startsWith(root+'\\')){res.writeHead(403).end();return;}try{res.setHeader('Content-Type',extname(path)==='.css'?'text/css':'text/javascript');res.end(readFileSync(path));}catch(error){res.writeHead(404).end();}});
await new Promise(resolve=>server.listen(8766,'127.0.0.1',resolve));
const browser=await(await loadChromium()).launch({headless:true});
try{
 for(const width of [360,390,430]){
  const page=await browser.newPage({viewport:{width,height:840},hasTouch:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8766/fixture');
  await page.selectOption('#type','green');assert.equal(await page.evaluate(()=>fixtureState().active),true);
  await page.selectOption('#size','20');assert.equal(await page.evaluate(()=>fixtureState().diameter),20);
  const box=await page.locator('#map').boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2;
  await page.mouse.move(x-30,y);await page.mouse.down();await page.mouse.move(x+30,y,{steps:10});await page.mouse.up();
  let result=await page.evaluate(()=>fixtureState());assert.ok(Object.keys(result.corrections).length>0);assert.ok(Object.values(result.corrections).every(c=>c.to==='green'));assert.equal(result.history,1);assert.equal(result.saves,1);assert.ok(result.raw.every(c=>c==='hard'));
  await page.click('#undo');assert.equal(Object.keys((await page.evaluate(()=>fixtureState())).corrections).length,0);
  await page.touchscreen.tap(x,y);result=await page.evaluate(()=>fixtureState());assert.ok(Object.keys(result.corrections).length>0);assert.equal(result.history,1);assert.equal(result.saves,2);assert.deepEqual(errors,[]);
  console.log(JSON.stringify({width,mouseStroke:true,touchStroke:true,diameterRestart:true,undo:true,rawPreserved:true,correctedCells:Object.keys(result.corrections).length}));await page.close();
 }
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
