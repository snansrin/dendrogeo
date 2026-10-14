import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {loadChromium} from './lib/playwright-runtime.mjs';

const root=resolve('.');
const server=createServer((req,res)=>{
 const path=resolve(root,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));
 if(!path.startsWith(root+'/')&&!path.startsWith(root+'\\')){res.writeHead(403).end();return;}
 try{res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.png':'image/png'})[extname(path)]||'application/octet-stream');res.end(readFileSync(path));}catch(error){res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(8765,'127.0.0.1',resolve));
const chromium=await loadChromium(),browser=await chromium.launch({headless:true});
// Fake session and read-only empty queries: no real account or database writes.
const authFixture=`window.supabase={createClient(){
 const session={user:{id:'startup-fixture',email:'startup@example.test'},access_token:'fixture'};
 const query=table=>{let chain;chain=new Proxy({}, {get(_target,key){if(key==='then')return resolve=>resolve({data:table==='profiles'?{full_name:'Startup test',role:'user'}:[],error:null,count:0});return()=>chain;}});return chain;};
 const channel={on(){return this;},subscribe(){return this;},track:async()=>{},unsubscribe:async()=>{},presenceState:()=>({})};
 return{auth:{getSession:async()=>({data:{session}}),onAuthStateChange(callback){setTimeout(()=>callback('INITIAL_SESSION',session),0);return{data:{subscription:{unsubscribe(){}}}};}},from:query,rpc:()=>query('rpc'),channel:()=>channel,removeChannel:async()=>{},realtime:{setAuth:async()=>{}}};
}};`;
try{
 for(const width of [360,390,430])for(const mode of ['session','oauth']){
  const page=await browser.newPage({viewport:{width,height:840}}),errors=[],tiles=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{if(request.url().includes('tile.openstreetmap.org'))tiles.push(request.url());});
  await page.route('**/vendor/supabase-js-2.116.0.js',route=>route.fulfill({contentType:'text/javascript',body:authFixture}));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,route=>route.abort());
  await page.addInitScript(()=>{localStorage.setItem('dg_last_view','nav');localStorage.setItem('dg_scroll_dash','1000');localStorage.setItem('dg_scrollw_dash','1800');});
  const started=Date.now();
  await page.goto('http://127.0.0.1:8765/index.html'+(mode==='oauth'?'?code=startup-fixture':''),{waitUntil:'domcontentloaded'});
  await page.locator('#shell').waitFor({state:'visible'});
  const state=await page.evaluate(()=>({view:document.querySelector('.view.on')?.id,cover:document.getElementById('dgStartupScreen').hidden,scroll:scrollY,width:document.documentElement.scrollWidth,viewport:innerWidth,file:!!document.getElementById('mPhoto').getClientRects().length}));
  assert.equal(state.view,'v-dash');assert.equal(state.cover,true);assert.equal(state.scroll,0);
  assert.equal(state.file,false);assert.ok(state.width<=state.viewport);assert.equal(tiles.length,0);
  assert.deepEqual(errors,[]);
  if(mode==='oauth')assert.equal(new URL(page.url()).search,'');
  const elapsed=Date.now()-started;
  // Navigation still initializes the maps after the clean dashboard start.
  await page.locator('#side .item').nth(2).click();
  await page.locator('#v-nav.on').waitFor({state:'visible'});
  await page.locator('#navMap.leaflet-container').waitFor({state:'attached'});
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({width,mode,startupMs:elapsed,view:state.view,hiddenFileInput:true,initialTileRequests:0,navigationMap:true}));
  await page.close();
 }
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
