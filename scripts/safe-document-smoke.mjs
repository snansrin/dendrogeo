import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {serveFixture,isolateAccount} from './lib/browser-acceptance-fixture.mjs';
import {webkit} from 'playwright-core';
import axe from 'axe-core';
const server=await serveFixture(),browser=await webkit.launch({headless:true});
try{
 for(const width of [360,390,430]){
  const page=await browser.newPage({viewport:{width,height:900},serviceWorkers:'block'});
  await isolateAccount(page,false);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const slug of ['privacy','data-protection','terms']){
   await page.goto(server.url+'/en/'+slug+'/');
   await page.waitForFunction(()=>!!window.DG_APPEARANCE);
   for(const dark of [false,true]){
    await page.evaluate(dark=>window.DG_APPEARANCE.set(dark?'dark':'light'),dark);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
    assert.equal(await page.locator('h1').count(),1);
    await page.waitForTimeout(400); // Let the existing appearance colour transition finish.
    await page.evaluate(axe.source);
    assert.deepEqual(await page.evaluate(async()=>(await axe.run({runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))),[]);
   }
  }
  const screenshots=await page.evaluate(async()=>{const manifest=await(await fetch('/manifest.json')).json();return await Promise.all(manifest.screenshots.map(async shot=>{const image=new Image();image.src='/'+shot.src;await image.decode();return {declared:shot.sizes,actual:image.naturalWidth+'x'+image.naturalHeight};}));});
  for(const shot of screenshots)assert.equal(shot.declared,shot.actual);
  await page.addScriptTag({url:new URL('/src/ui/toast-message-content.js',page.url()).href});
  const result=await page.evaluate(()=>{
   const div=document.createElement('div');window.DG_TOAST_MESSAGE_CONTENT.render(div,'<b onclick="alert(1)">Safe <em>help</em></b><img src=x onerror=alert(1)><script>alert(1)</script><iframe src=javascript:alert(1)></iframe><a href=javascript:alert(1)>link</a><svg onload=alert(1)></svg><span style=color:red data-private=x>plain</span>');
   return {bold:div.querySelector('b')?.textContent,attributes:div.querySelector('b')?.attributes.length,active:div.querySelectorAll('img,script,iframe,a,svg').length,text:div.textContent,attributeCount:[...div.querySelectorAll('*')].reduce((sum,node)=>sum+node.attributes.length,0)};
  });
  assert.equal(result.bold,'Safe help');assert.equal(result.attributes,0);assert.equal(result.active,0);assert.equal(result.attributeCount,0);assert.ok(result.text.includes('<img'));
  assert.deepEqual(errors,[]);console.log(JSON.stringify({width,englishPolicies:true,overflow:false,accessibility:true,toastSanitizer:true}));await page.close();
 }
}finally{await browser.close();await server.close();}
