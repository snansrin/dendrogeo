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
  await dialog.locator('[name="boundaryColor"]').fill('#ff0000');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  const box=await dialog.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width+1);
  await page.addScriptTag({content:axe.source});
  assert.deepEqual(await page.evaluate(async()=> (await axe.run(document.getElementById('dgSurfaceExportDialog'))).violations.map(v=>v.id)),[]);
  if(process.env.DG_QA_SCREENSHOT_DIR)await page.screenshot({animations:'disabled',path:join(process.env.DG_QA_SCREENSHOT_DIR,'map-options-'+theme+'-'+width+'.png')});
  await dialog.locator('#dgExportDownload').click();assert.deepEqual(await page.evaluate(()=>__mapDownload),{park:true,surface:false,grid:false,waypoints:false,mapOnly:true,boundaryColor:'#ff0000'});
 }
 console.log(JSON.stringify({width,themes:['light','dark'],mapOnly:true,boundaryColor:true,noOverflow:true}));await page.close();
}
 const page=await browser.newPage({serviceWorkers:'block'});await isolateAccount(page);await page.goto(server.url);await page.waitForFunction(()=>document.getElementById('dgStartupScreen').hidden);await page.evaluate(()=>dgEnsureLulc());await mockExportTiles(page);
 for(const base of ['osm','sat','topo']){
  const result=await page.evaluate(async base=>{
   const rings=[[[39.96,32.82],[39.96,32.83],[39.97,32.83],[39.97,32.82],[39.96,32.82]]],state={epoch:1,geometry:{},epsg:32636,base},record={features:[],corrections:{}},before=JSON.stringify(record);let capture;
   const captured=new Promise(resolve=>capture=resolve),click=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){if(!this.download)return click.call(this);fetch(this.href).then(r=>r.blob()).then(async blob=>{const img=await createImageBitmap(blob),c=document.createElement('canvas');c.width=img.width;c.height=img.height;const g=c.getContext('2d');g.drawImage(img,0,0);const pixels=g.getImageData(0,0,c.width,c.height).data;let colored=0,red=0;for(let i=0;i<pixels.length;i+=4){if(pixels[i]<220&&pixels[i+1]>100&&pixels[i+2]>100)colored++;if(pixels[i]>220&&pixels[i+1]<60&&pixels[i+2]<60)red++;}capture({filename:this.download,width:c.width,height:c.height,colored,red});});};
   try{await DG_RENDER_VERIFIED_SURFACE_MAP_EXPORT.render({layers:{mapOnly:true,park:true,surface:false,boundaryColor:'#ff0000'},state,record,cells:[{}],editSummary:()=>({total:0}),toast:(msg,type)=>{if(type==='err')throw Error(msg);},translate:String,escape:esc,getAreas:()=>({}),getParkRings:()=>rings,getGridCells:()=>[],getPark:()=>({id:49}),getParts:()=>{throw Error('Surface computation forbidden');},prepareFrame:args=>DG_PREPARE_SURFACE_EXPORT_MAP_FRAME.prepare({...args,forward:dgLcUtmForward}),drawLayers:DG_DRAW_SURFACE_EXPORT_MAP_LAYERS.draw,renderInfo:()=>{throw Error('Report forbidden');},document,redraw(){}});return{...await captured,unchanged:JSON.stringify(record)===before};}finally{HTMLAnchorElement.prototype.click=click;}
  },base);
  assert.equal(result.filename,'dendrogeo_harita_49.png');assert.equal(result.width,1240);assert.equal(result.height,1240);assert.ok(result.colored>1200000,'basemap fills the map');assert.ok(result.red>3000,'selected outline color is present');assert.ok(result.unchanged);console.log(JSON.stringify({base,...result}));
 }
 await page.close();
}finally{await browser.close();await server.close();}
