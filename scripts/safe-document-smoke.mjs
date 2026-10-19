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
    await page.addScriptTag({content:axe.source});
    assert.deepEqual(await page.evaluate(async()=>(await axe.run({runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))),[]);
   }
  }
  await page.addScriptTag({content:readFileSync('src/ui/toast-message-content.js','utf8')});
  const result=await page.evaluate(()=>{
   const div=document.createElement('div');window.DG_TOAST_MESSAGE_CONTENT.render(div,'<b onclick="alert(1)">Safe <em>help</em></b><img src=x onerror=alert(1)><script>alert(1)</script>');
   return {bold:div.querySelector('b')?.textContent,attributes:div.querySelector('b')?.attributes.length,active:div.querySelectorAll('img,script').length,text:div.textContent};
  });
  assert.equal(result.bold,'Safe help');assert.equal(result.attributes,0);assert.equal(result.active,0);assert.ok(result.text.includes('<img'));
  assert.deepEqual(errors,[]);console.log(JSON.stringify({width,englishPolicies:true,overflow:false,accessibility:true,toastSanitizer:true}));await page.close();
 }
}finally{await browser.close();await server.close();}
