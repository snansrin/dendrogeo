import{serveFixture,isolateAccount}from'./lib/browser-acceptance-fixture.mjs';
import{loadChromium}from'./lib/playwright-runtime.mjs';
const server=await serveFixture(),chromium=await loadChromium(),browser=await chromium.launch({headless:true});
try{const page=await browser.newPage({viewport:{width:1280,height:1000},serviceWorkers:'block',reducedMotion:'reduce'});await isolateAccount(page,false);
 for(const mode of['map','analysis','drawing','ndvi']){await page.goto(server.url+'/ornekler/goksu-parki/?view='+mode,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.documentElement.dataset.exampleReady==='true');await page.locator('.example-main').screenshot({path:'assets/landing/goksu-'+mode+'.jpg',type:'jpeg',quality:90});console.log('Captured accepted example: '+mode);}
}finally{await browser.close();await server.close();}
