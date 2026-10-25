import assert from 'node:assert/strict';
import {join} from 'node:path';
import {serveFixture,isolateAccount} from './lib/browser-acceptance-fixture.mjs';
import {loadChromium} from './lib/playwright-runtime.mjs';
import {mockExportTiles} from './lib/export-tile-fixture.mjs';
import axe from 'axe-core';
const engine=process.env.DG_UI_BROWSER==='webkit'?(await import('playwright-core')).webkit:await loadChromium(),server=await serveFixture(),browser=await engine.launch({headless:true});
try{for(const width of [360,390,430,1280]){
 const page=await browser.newPage({viewport:{width,height:900},serviceWorkers:'block'});await isolateAccount(page);await page.goto(server.url);await page.waitForFunction(()=>document.getElementById('dgStartupScreen').hidden);await page.evaluate(()=>dgEnsureLulc());
 for(const theme of ['light','dark']){
  await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;window.__mapDownload=null;DG_RENDER_VERIFIED_SURFACE_MAP_EXPORT.openDialog({document,grid:false,waypoints:[],escape:esc,translate:String,renderDialog:DG_RENDER_SURFACE_EXPORT_LAYER_DIALOG.render,renderPng:layers=>window.__mapDownload=layers});},theme);
  const dialog=page.locator('#dgSurfaceExportDialog');await dialog.waitFor({state:'visible'});await dialog.locator('[name="mapOnly"]').check();
  assert.equal(await dialog.locator('[name="surface"]').isChecked(),false);assert.equal(await dialog.locator('[name="park"]').isChecked(),true);
  assert.equal(await dialog.locator('[name="grid"]').isDisabled(),true);
  const color=dialog.locator('[name="boundaryColor"]');assert.equal(await color.getAttribute('type'),'color');assert.equal(await dialog.locator('#dgExportColorPanel,input[type="range"]').count(),0);
  await color.fill('#ff0000');await color.click();
  const nativeOpen=await color.evaluate(el=>CSS.supports('selector(input:open)')?el.matches(':open'):null);
  if(process.env.DG_QA_SCREENSHOT_DIR)await page.screenshot({animations:'disabled',path:join(process.env.DG_QA_SCREENSHOT_DIR,'native-palette-'+theme+'-'+width+'.png')});
  await dialog.locator('#dgExportColorDone').click();assert.equal(await color.inputValue(),'#ff0000');assert.equal(await dialog.isVisible(),true);
  if(nativeOpen)await page.waitForFunction(()=>!document.getElementById('dgExportBoundaryColor').matches(':open'));
  await dialog.locator('#dgExportColorDone').focus();await page.keyboard.press('Enter');assert.equal(await color.inputValue(),'#ff0000');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  const box=await dialog.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width+1);
  assert.equal(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1),true,'dialog content must not scroll horizontally');
  await page.evaluate(axe.source);
  assert.deepEqual(await page.evaluate(async()=> (await axe.run(document.getElementById('dgSurfaceExportDialog'))).violations.map(v=>v.id)),[]);
  if(process.env.DG_QA_SCREENSHOT_DIR)await page.screenshot({animations:'disabled',path:join(process.env.DG_QA_SCREENSHOT_DIR,'map-options-'+theme+'-'+width+'.png')});
  await dialog.locator('#dgExportDownload').click();assert.deepEqual(await page.evaluate(()=>__mapDownload),{park:true,surface:false,grid:false,waypoints:false,mapOnly:true,boundaryColor:'#ff0000'});
  await dialog.waitFor({state:'detached'});
 }
 await page.evaluate(()=>DG_RENDER_VERIFIED_SURFACE_MAP_EXPORT.openDialog({document,grid:true,waypoints:[],escape:esc,translate:String,renderDialog:DG_RENDER_SURFACE_EXPORT_LAYER_DIALOG.render,renderPng:layers=>window.__mapDownload=layers}));
 const gridDialog=page.locator('#dgSurfaceExportDialog');await gridDialog.waitFor({state:'visible'});assert.equal(await gridDialog.locator('[name="grid"]').isChecked(),false);await gridDialog.locator('[name="grid"]').check();await gridDialog.locator('#dgExportDownload').click();assert.equal(await page.evaluate(()=>__mapDownload.grid),true);await gridDialog.waitFor({state:'detached'});
 console.log(JSON.stringify({width,themes:['light','dark'],mapOnly:true,boundaryColor:true,noOverflow:true}));await page.close();
}
 const page=await browser.newPage({serviceWorkers:'block'});await isolateAccount(page);await page.goto(server.url);await page.waitForFunction(()=>document.getElementById('dgStartupScreen').hidden);await page.evaluate(()=>dgEnsureLulc());await mockExportTiles(page,{solid:true});
 for(const base of ['osm','sat','topo'])for(const grid of [false,true]){
  const result=await page.evaluate(async({base,grid})=>{
   const rings=[[[39.96,32.82],[39.96,32.83],[39.97,32.83],[39.97,32.82],[39.96,32.82]],[[39.964,32.824],[39.966,32.824],[39.966,32.826],[39.964,32.826],[39.964,32.824]]],state={epoch:1,geometry:{},epsg:32636,base},record={features:[],corrections:{}},before=JSON.stringify(record);let capture,frame;
   const captured=new Promise(resolve=>capture=resolve),click=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){if(!this.download)return click.call(this);fetch(this.href).then(r=>r.blob()).then(async blob=>{const img=await createImageBitmap(blob),c=document.createElement('canvas');c.width=img.width;c.height=img.height;const g=c.getContext('2d');g.drawImage(img,0,0);const pixels=g.getImageData(0,0,c.width,c.height).data;let colored=0,red=0,gridPixels=0;for(let i=0;i<pixels.length;i+=4){if(pixels[i]<220&&pixels[i+1]>100&&pixels[i+2]>100)colored++;if(pixels[i]>220&&pixels[i+1]<60&&pixels[i+2]<60)red++;if(i/4<c.width*(c.height-44)&&pixels[i]<40&&pixels[i+1]>60&&pixels[i+1]<120&&pixels[i+2]<75)gridPixels++;}const at=(lat,lon)=>{const [x,y]=frame.canvasProject(lat,lon,{x:0,y:0,width:1240,height:1196,margin:20});return Array.from(g.getImageData(Math.round(x),Math.round(y),1,1).data);};const inside=at(39.962,32.822),hole=at(39.965,32.825),outside=Array.from(g.getImageData(10,10,1,1).data);capture({filename:this.download,width:c.width,height:c.height,colored,red,gridPixels,inside,hole,outside});});};
   try{await DG_RENDER_VERIFIED_SURFACE_MAP_EXPORT.render({layers:{mapOnly:true,park:true,surface:false,grid,boundaryColor:'#ff0000'},state,record,cells:[{}],editSummary:()=>({total:0}),toast:(msg,type)=>{if(type==='err')throw Error(msg);},translate:String,escape:esc,getAreas:()=>({}),getParkRings:()=>rings,getGridCells:()=>{if(!grid)throw Error('Unselected grid read');return[{geometry:{coordinates:[[[[32.821,39.961],[32.823,39.961],[32.823,39.963],[32.821,39.963],[32.821,39.961]]]]}}];},getPark:()=>({id:49}),getParts:()=>{throw Error('Surface computation forbidden');},prepareFrame:args=>frame=DG_PREPARE_SURFACE_EXPORT_MAP_FRAME.prepare({...args,forward:dgLcUtmForward}),drawLayers:DG_DRAW_SURFACE_EXPORT_MAP_LAYERS.draw,renderInfo:()=>{throw Error('Report forbidden');},document,redraw(){}});return{...await captured,unchanged:JSON.stringify(record)===before};}finally{HTMLAnchorElement.prototype.click=click;}
  },{base,grid});
  assert.equal(result.filename,'dendrogeo_harita_49.png');assert.equal(result.width,1240);assert.equal(result.height,1240);assert.ok(result.colored>800000,'basemap fills only the park');assert.ok(result.red>3000,'selected outline color is present');assert.deepEqual(result.outside,[255,255,255,255]);assert.deepEqual(result.hole,[255,255,255,255]);assert.deepEqual(result.inside,[134,182,168,255]);assert.ok(grid?result.gridPixels>100:result.gridPixels===0);assert.ok(result.unchanged);console.log(JSON.stringify({base,grid,...result}));
 }
 await page.close();
}finally{await browser.close();await server.close();}
