import assert from 'node:assert/strict';
import {serveFixture,isolateAccount} from './lib/browser-acceptance-fixture.mjs';
import {loadChromium} from './lib/playwright-runtime.mjs';
const engine=process.env.DG_UI_BROWSER==='webkit'?(await import('playwright-core')).webkit:await loadChromium();
const server=await serveFixture(),browser=await engine.launch({headless:true});
try{for(const width of [360,390,430,1280]){
 const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'}),page=await context.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await isolateAccount(page);await page.addInitScript(()=>{window.__cspViolations=[];document.addEventListener('securitypolicyviolation',e=>window.__cspViolations.push({directive:e.effectiveDirective,blocked:e.blockedURI}));});
 await page.goto(server.url);await page.locator('#shell').waitFor({state:'visible'});await page.waitForFunction(()=>document.getElementById('dgStartupScreen').hidden);
 await page.evaluate(()=>{window.__cspReady=false;window.__cspError=null;(async()=>{await dgEnsureLulc();await go('map');initMaps();})().then(()=>window.__cspReady=true,e=>window.__cspError=String(e));});
 await page.waitForFunction(()=>window.__cspReady||window.__cspError);assert.equal(await page.evaluate(()=>window.__cspError),null);
 assert.deepEqual(await page.evaluate(()=>__cspViolations),[],'startup, original runtime scripts and lazy analysis libraries must be authorized');
 assert.equal(await page.locator('#v-map .leaflet-container').count(),1);
 await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit',route=>route.fulfill({contentType:'text/javascript',body:'window.__turnstileAllowed=true;'}));
 await page.evaluate(()=>{const s=document.createElement('script');s.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';document.head.append(s);});
 await page.waitForFunction(()=>window.__turnstileAllowed);assert.deepEqual(await page.evaluate(()=>__cspViolations),[],'the existing challenge provider must remain usable');
 await page.evaluate(()=>{const s=document.createElement('script');s.textContent='window.__unexpectedInline=true';document.head.append(s);const external=document.createElement('script');external.src='https://server.arcgisonline.com/csp-fixture.js';document.head.append(external);});
 await page.waitForFunction(()=>__cspViolations.filter(e=>e.directive==='script-src-elem').length===2);
 assert.equal(await page.evaluate(()=>window.__unexpectedInline),undefined,'arbitrary inline executable text must be blocked');
 assert.deepEqual(errors,[]);console.log(JSON.stringify({browser:process.env.DG_UI_BROWSER||'chromium',width,runtimeAndLazyAnalysis:true,challengeProvider:true,inlineBlocked:true,imageProviderScriptBlocked:true,errors}));await context.close();
}}finally{await browser.close();await server.close();}
