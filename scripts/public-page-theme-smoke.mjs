import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import axe from 'axe-core';
import {join,relative} from 'node:path';
import {loadChromium} from './lib/playwright-runtime.mjs';
import {serveFixture} from './lib/browser-acceptance-fixture.mjs';
const server=await serveFixture(),browser=await(await loadChromium()).launch({headless:true,ignoreDefaultArgs:['--hide-scrollbars']});
const pages=[];
// Select an existing sealed artifact; report retraction must not invalidate the reader test.
const readerSample=readdirSync('rapor').filter(name=>existsSync(join('rapor',name,'manifest.json'))&&readFileSync(join('rapor',name,'index.html'),'utf8').includes('id="dgVerify"')).sort().at(-1);
assert.ok(readerSample,'A sealed report fixture is required for the reader regression');
function collect(dir){for(const e of readdirSync(dir,{withFileTypes:true})){const p=join(dir,e.name);if(e.isDirectory()&&!['node_modules','.git','vendor'].includes(e.name))collect(p);else if(e.isFile()&&p.endsWith('.html')&&readFileSync(p,'utf8').includes('<!-- dg-public-theme -->'))pages.push('/'+relative('.',p).replaceAll('\\','/'));}}
collect('.');
try{
 for(const width of [311,360,390,430]){
  const page=await browser.newPage({viewport:{width,height:840},reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,route=>route.abort());
  await page.addInitScript(()=>{if(!localStorage.getItem('dg_appearance'))localStorage.setItem('dg_appearance','dark');});
  for(const path of pages.filter(p=>!p.includes('/gorunum/'))){
   await page.goto(server.url+path,{waitUntil:'load'});
   assert.equal(await page.locator('html').getAttribute('data-theme'),'dark',path);
   assert.equal(await page.locator('body').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(16, 17, 19)',path);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`overflow ${width} ${path}`);
   assert.equal(await page.locator('[data-dg-dark-mode]').count(),1,path);
   if(width===390){await page.addScriptTag({content:axe.source});const contrast=await page.evaluate(async()=> (await axe.run(document,{runOnly:{type:'rule',values:['color-contrast']}})).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})));assert.deepEqual(contrast,[],path+' dark contrast');}
   await page.locator('[data-dg-dark-mode]').uncheck();
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   assert.equal(await page.locator('html').getAttribute('data-theme'),'light',path);
   if(width===390){await page.addScriptTag({content:axe.source});const contrast=await page.evaluate(async()=> (await axe.run(document,{runOnly:{type:'rule',values:['color-contrast']}})).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})));assert.deepEqual(contrast,[],path+' light contrast');}
   await page.locator('[data-dg-dark-mode]').check();
  }
  await page.goto(server.url+'/rapor/gorunum/?id='+readerSample);
  await page.locator('#readerPrint').waitFor({state:'visible'});
  await page.waitForFunction(()=>!document.getElementById('readerPrint').disabled);
  const geometry=await page.locator('#reportFrame').evaluate(f=>({height:f.contentDocument.documentElement.clientHeight,content:f.contentDocument.documentElement.scrollHeight,style:f.getAttribute('style')}));
  assert.ok(geometry.content<=geometry.height+1,'nested report scroll: '+JSON.stringify(geometry));
  const frame=page.frameLocator('#reportFrame');
  assert.equal(await frame.locator('html').getAttribute('data-theme'),'dark');
  assert.match(await frame.locator('#dgVerify').textContent(),/İçerik bütünlüğü doğrulandı/);
  await page.locator('[data-dg-dark-mode]').uncheck();
  await page.waitForFunction(()=>document.getElementById('reportFrame').contentDocument.documentElement.dataset.theme==='light');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.goto(server.url+'/yontem/');
  assert.equal(await page.locator('html').getAttribute('data-theme'),'light','appearance persists between documents');
  await page.goto(server.url+'/rapor/gorunum/?id=../../invalid');
  assert.match(await page.locator('#readerStatus').textContent(),/Geçerli bir rapor seçilmedi/);
  assert.deepEqual(errors,[]);await page.close();
 }
 for(const name of readdirSync('rapor')){
  const path=join('rapor',name,'manifest.json');if(!existsSync(path))continue;
  for(const file of JSON.parse(readFileSync(path,'utf8')).files||[]){assert.equal(createHash('sha256').update(readFileSync(join('rapor',name,file.name))).digest('hex'),file.sha256,`${name}/${file.name}`);}
 }
 console.log(`✅ ${pages.length} public pages: dark/light at 311/360/390/430px, theme-aware report reader and immutable artifact hashes.`);
}finally{await browser.close();await server.close();}
