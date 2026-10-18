import{serveFixture,isolateAccount}from'./lib/browser-acceptance-fixture.mjs';
import{loadChromium}from'./lib/playwright-runtime.mjs';
const server=await serveFixture(),chromium=await loadChromium(),browser=await chromium.launch({headless:true});
try{const page=await browser.newPage({viewport:{width:1280,height:1000},serviceWorkers:'block',reducedMotion:'reduce'});await isolateAccount(page,false);
 const indexes={map:1,analysis:2,drawing:3,ndvi:4};await page.goto(server.url+'/#ozellikler',{waitUntil:'load'});
 for(const mode of Object.keys(indexes)){await page.locator(`[data-showcase-index="${indexes[mode]}"]`).click();const scene=page.locator(`[data-landing-scene="${mode}"]`);await scene.locator('[data-scene-canvas] svg').waitFor();await scene.screenshot({path:'assets/landing/goksu-'+mode+'.jpg',type:'jpeg',quality:90});console.log('Captured landing interactive scene: '+mode);}
}finally{await browser.close();await server.close();}
