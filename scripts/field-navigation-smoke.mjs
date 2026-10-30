import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {serveFixture,isolateAccount} from './lib/browser-acceptance-fixture.mjs';
import {loadChromium} from './lib/playwright-runtime.mjs';
const engine=process.env.DG_UI_BROWSER==='webkit'?(await import('playwright-core')).webkit:await loadChromium();
const server=await serveFixture(),browser=await engine.launch({headless:true});
mkdirSync('work/field-navigation',{recursive:true});
try{for(const width of [360,390,430]){
 const page=await browser.newPage({viewport:{width,height:950}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));await isolateAccount(page);
 await page.goto(server.url);await page.waitForFunction(()=>document.getElementById('dgStartupScreen').hidden);
 await page.evaluate(async()=>{
  await loadProjects();PROJ_LIST=[{id:1,park_id:25,name:'Fixture project',owner:USER.id}];
  for(const id of ['mProject','nProject'])document.getElementById(id).innerHTML='<option value="1">Fixture project</option>';
  await go('measure');document.getElementById('mGroup').value='YAPRAKLI';fillSpecies();
 });
 const png=await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=400;const c=canvas.getContext('2d');c.fillStyle='#628c42';c.fillRect(0,0,400,400);c.fillStyle='#735438';c.fillRect(180,0,40,400);return canvas.toDataURL('image/png').split(',')[1];});
 await page.locator('#mPhoto').setInputFiles({name:'sahada-olcum-agaci-uzun-fotograf-dosya-adi-123456789.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
 await page.waitForFunction(()=>document.getElementById('mPhotoRemove').style.display!=='none');
 for(const theme of ['light','dark']){
  await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
  const layout=await page.evaluate(()=>{
   const row=document.querySelector('.measure-photo'),boxes=[...row.children].map(e=>e.getBoundingClientRect());
   const overlap=boxes.some((a,i)=>boxes.slice(i+1).some(b=>a.width&&a.height&&b.width&&b.height&&a.left<b.right-1&&a.right>b.left+1&&a.top<b.bottom-1&&a.bottom>b.top+1));
   return{overlap,overflow:document.documentElement.scrollWidth>innerWidth+1,within:boxes.every(b=>b.left>=0&&b.right<=innerWidth)};
  });assert.deepEqual(layout,{overlap:false,overflow:false,within:true});
  await page.locator('.measure-tree').screenshot({path:`work/field-navigation/photo-${engine.name()}-${width}-${theme}.png`});
 }
 await page.locator('#mPhotoRemove').click();assert.equal(await page.locator('#mPhoto').inputValue(),'');
 const navigation=await page.evaluate(async()=>{
  const point={id:11,project_id:1,wp_id:34,lat:39,lon:32,visited:true};let evidence=[],writes=0;
  sb.from=table=>{const q={select(){return q;},eq(){return q;},in(){return q;},order(){return table==='waypoints'?Promise.resolve({data:[point],error:null}):q;},range(){return Promise.resolve({data:evidence,error:null});},update(){writes++;return q;},then(resolve){resolve({data:[],error:null});}};return q;};
  GPS={latitude:38.9999,longitude:32,accuracy:5};await loadWaypoints();navTarget=WP[0];manualPoint=true;document.getElementById('mPoint').value='999';
  await go('nav');await loadWaypoints();navTarget=WP[0];drawNav();await arriveWp();await loadWaypoints();
  const arrived={visited:WP[0].visited,point:document.getElementById('mPoint').value,project:document.getElementById('mProject').value,writes};
  evidence=[{point_id:34,girth_cm:100,height_m:8,status:'Beklemede'}];await loadWaypoints();const saved=WP[0].visited;
  evidence=[];await loadWaypoints();const removed=WP[0].visited;
  await go('nav');await loadWaypoints();navTarget=WP[0];drawNav();
  const send=heading=>{const event=new Event('deviceorientation');Object.defineProperties(event,{webkitCompassHeading:{value:heading},webkitCompassAccuracy:{value:5}});window.dispatchEvent(event);};
  send(90);const east=document.getElementById('navArrow').style.transform;
  send(180);const south=document.getElementById('navArrow').style.transform;
  return{arrived,saved,removed,east,south,visible:document.getElementById('navArrow').style.visibility};
 });
 assert.deepEqual(navigation,{arrived:{visited:false,point:'34',project:'1',writes:0},saved:true,removed:false,east:'rotate(270deg)',south:'rotate(180deg)',visible:'visible'});
 assert.deepEqual(errors,[]);console.log(JSON.stringify({engine:engine.name(),width,photoLayout:true,arrivalWithoutWrite:true,completionFromData:true,liveHeading:true}));
 await page.close();
}}finally{await browser.close();await server.close();}
