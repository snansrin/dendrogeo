import assert from 'node:assert/strict';
import {serveFixture,isolateAccount} from './lib/browser-acceptance-fixture.mjs';
import {mockExportTiles} from './lib/export-tile-fixture.mjs';
import {loadChromium} from './lib/playwright-runtime.mjs';
const engine=process.env.DG_UI_BROWSER==='webkit'?(await import('playwright-core')).webkit:await loadChromium();
const server=await serveFixture(),browser=await engine.launch({headless:true});
try{for(const width of [360,390,430]){
 const page=await browser.newPage({viewport:{width,height:950},serviceWorkers:'block'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await isolateAccount(page);await page.goto(server.url);
 await page.waitForFunction(()=>document.getElementById('dgStartupScreen').hidden);await page.evaluate(()=>dgEnsureLulc());await mockExportTiles(page,{solid:true});
 const result=await page.evaluate(async()=>{
  // The active getter is separately tested against the real workspace's
  // successful-open/park/access checks. Here the grid selector intentionally differs.
  window.DG_LIVE_MAP_PROJECTS={activeProjectId:()=>33};
  let grid=document.getElementById('gridProject');if(!grid){grid=document.createElement('select');grid.id='gridProject';grid.hidden=true;document.body.append(grid);}
  grid.innerHTML='<option value="7">Old grid project</option>';
  WP=[{project_id:33,wp_id:1,lat:39.963,lon:32.823,visited:false},{project_id:77,wp_id:9,lat:39.967,lon:32.827,visited:false}];
  LAST_WP_ROWS=[{project_id:33,wp_id:2,lat:39.965,lon:32.825,visited:true}];
  const original=DG_RENDER_VERIFIED_SURFACE_MAP_EXPORT;let selected;
  window.DG_RENDER_VERIFIED_SURFACE_MAP_EXPORT={...original,openDialog:args=>{selected=args.waypoints;original.openDialog({...args,renderPng(){}});}};
  dgSensExportPng();window.DG_RENDER_VERIFIED_SURFACE_MAP_EXPORT=original;
  const enabled=!document.querySelector('#dgSurfaceExportDialog [name="waypoints"]').disabled;
  document.getElementById('dgSurfaceExportDialog').close();
  const rings=[[[39.96,32.82],[39.96,32.83],[39.97,32.83],[39.97,32.82],[39.96,32.82]]];
  const record={acceptedAt:'2026-10-01T00:00:00Z',features:[],corrections:{}},before=JSON.stringify(record),pointsBefore=JSON.stringify([WP,LAST_WP_ROWS]);
  let resolve,frame;const downloaded=new Promise(r=>resolve=r),nativeClick=HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click=function(){if(!this.download)return nativeClick.call(this);const filename=this.download;fetch(this.href).then(r=>r.blob()).then(async blob=>{
   const bitmap=await createImageBitmap(blob),canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;const g=canvas.getContext('2d');g.drawImage(bitmap,0,0);
   const pixel=(lat,lon)=>{const [x,y]=frame.canvasProject(lat,lon,{x:40,y:240,width:760,height:1136,margin:20});return Array.from(g.getImageData(Math.round(x),Math.round(y),1,1).data);};
   resolve({filename,red:pixel(39.963,32.823),green:pixel(39.965,32.825),foreign:pixel(39.967,32.827)});
  });};
  await original.render({layers:{park:true,surface:false,grid:false,waypoints:true},waypoints:selected,state:{epoch:1,geometry:{},epsg:32636,base:'osm'},record,cells:[{center:{lat:39.96,lon:32.82}}],editSummary:()=>({total:0}),toast(){},translate:String,escape:esc,getAreas:()=>({green:1000}),getRasterAreas:()=>({green:1000}),getParkRings:()=>rings,getGridCells:()=>[],getPark:()=>({id:53,name:'Stage fixture'}),getParts:()=>[],prepareFrame:args=>(frame=DG_PREPARE_SURFACE_EXPORT_MAP_FRAME.prepare({...args,forward:dgLcUtmForward})),drawLayers:DG_DRAW_SURFACE_EXPORT_MAP_LAYERS.draw,renderInfo(){},colors:{},document,redraw(){}});
  const png=await downloaded;HTMLAnchorElement.prototype.click=nativeClick;
  return{enabled,ids:selected.map(row=>row.wp_id).sort(),png,unchanged:before===JSON.stringify(record)&&pointsBefore===JSON.stringify([WP,LAST_WP_ROWS])};
 });
 assert.equal(result.enabled,true);assert.deepEqual(result.ids,[1,2]);assert.deepEqual(result.png.red,[239,68,68,255]);assert.deepEqual(result.png.green,[34,197,94,255]);assert.notDeepEqual(result.png.foreign,[239,68,68,255]);assert.match(result.png.filename,/dogrulanmis/);assert.equal(result.unchanged,true);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({engine:engine.name(),width,staleGridIgnored:true,verifiedPngWaypointsVisible:true,foreignProjectExcluded:true,recordsUnchanged:true}));await page.close();
}}finally{await browser.close();await server.close();}
