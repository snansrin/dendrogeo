import assert from'node:assert/strict';
import{mkdirSync}from'node:fs';
import axe from'axe-core';
import{serveFixture,isolateAccount}from'./lib/browser-acceptance-fixture.mjs';
import{loadChromium}from'./lib/playwright-runtime.mjs';
const server=await serveFixture(),chromium=await loadChromium(),engine=process.env.DG_UI_BROWSER==='webkit'?(await import('playwright-core')).webkit:chromium,browser=await engine.launch({headless:true});
const output=process.env.DG_LANDING_OUTPUT;if(output)mkdirSync(output,{recursive:true});
try{for(const width of[360,390,430,1440]){
 const page=await browser.newPage({viewport:{width,height:1100},serviceWorkers:'block',reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));await isolateAccount(page,false);
 await page.goto(server.url,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.getElementById('dgStartupScreen').hidden);await page.locator('[data-dg-showcase]').waitFor();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
 const field=await page.evaluate(()=>{const scene=document.querySelector('[data-showcase-name="tree"]'),art=scene.querySelector('.hero-art'),labels=art.querySelector('.dg-tree-readouts'),walker=art.querySelector('.walkerA'),height=[...labels.querySelectorAll('foreignObject')].find(node=>node.textContent.includes('Ağaç boyu'));return{sameSvg:labels.ownerSVGElement===walker.ownerSVGElement,labelsBehind:!!(labels.compareDocumentPosition(walker)&Node.DOCUMENT_POSITION_FOLLOWING),ratio:art.clientWidth/scene.clientWidth,heightX:Number(height?.getAttribute('x')),heightY:Number(height?.getAttribute('y'))};});
 assert.equal(field.sameSvg,true);assert.equal(field.labelsBehind,true);assert.ok(field.ratio>.95);assert.equal(field.heightX,500);assert.equal(field.heightY,50);
 await page.waitForFunction(()=>[...document.styleSheets].some(sheet=>sheet.href?.includes('/css/appearance.css')&&sheet.cssRules.length>0&&sheet.ownerNode?.media==='all'));
 const readResourceIcons=()=>page.evaluate(()=>[...document.querySelectorAll('.dg-resource-card:not(:first-child) .dg-resource-icon')].map(icon=>{const svg=icon.querySelector('svg');return{color:getComputedStyle(icon).color,background:getComputedStyle(icon).backgroundColor,stroke:svg?getComputedStyle(svg).stroke:'none',visible:!!svg&&svg.getBoundingClientRect().width>0&&getComputedStyle(svg).visibility==='visible'};}));
 await page.evaluate(()=>window.DG_APPEARANCE.set('light'));await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const lightIcons=await readResourceIcons();
 await page.evaluate(()=>window.DG_APPEARANCE.set('dark'));await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const darkIcons=await readResourceIcons();
 assert.equal(lightIcons.length,5);assert.equal(darkIcons.length,5);assert.ok(lightIcons.every(icon=>icon.visible&&icon.stroke!=='none'));assert.ok(darkIcons.every(icon=>icon.visible&&icon.stroke!=='none'));assert.notEqual(lightIcons[0].color,darkIcons[0].color);assert.notEqual(lightIcons[0].background,darkIcons[0].background);
 await page.evaluate(()=>window.DG_APPEARANCE.set('light'));
 if(output)await page.locator('[data-showcase-name="tree"]').screenshot({path:output+'/field-'+width+'.png'});
 await page.addScriptTag({content:axe.source});
 for(const[index,mode]of['map','analysis','drawing','ndvi'].entries()){
  await page.locator('[data-showcase-index="'+(index+1)+'"]').click();const host=page.locator('[data-landing-scene="'+mode+'"]');await host.locator('[data-scene-class]').first().waitFor();
  assert.equal(await host.getAttribute('data-scene-ready'),'true');
  const svg=host.locator('svg.dg-scene-map');await host.locator('[data-scene-zoom="0.5"]').click();assert.notEqual(await svg.getAttribute('viewBox'),'0 0 600 460');await host.locator('[data-scene-zoom="reset"]').click();assert.equal(await svg.getAttribute('viewBox'),'0 0 600 460');
  if(mode!=='drawing'){const path=host.locator('[data-scene-class]').first();await path.focus();await path.press('Enter');assert.equal(await path.getAttribute('aria-pressed'),'true');}
  else{const canvas=host.locator('[data-scene-canvas]');await canvas.focus();await canvas.press('Enter');await canvas.press('Enter');await canvas.press('Enter');assert.equal(await canvas.locator('.dg-scene-vertex').count(),3);await host.locator('[data-scene-undo]').click();assert.equal(await canvas.locator('.dg-scene-vertex').count(),2);await host.locator('[data-scene-clear]').click();assert.equal(await canvas.locator('.dg-scene-vertex').count(),0);}
  const violations=await page.evaluate(async selector=>(await axe.run(document.querySelector(selector),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})),'[data-landing-scene="'+mode+'"]');assert.deepEqual(violations,[],mode+' accessibility');
  if(output)await host.screenshot({path:output+'/'+mode+'-'+width+'.png'});
 }
 await page.evaluate(()=>dgSetLang('en'));await page.waitForFunction(()=>document.querySelector('[data-landing-scene="map"] [data-scene-pick="water"]').textContent==='Water');assert.equal(await page.locator('.dg-tree-readouts [data-i18n="Ağaç boyu"]').textContent(),'Tree height');assert.equal(await page.locator('[data-landing-scene="map"] [data-scene-class="water"]').getAttribute('aria-label'),'Water');await page.evaluate(()=>dgSetLang('tr'));
 assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);console.log(JSON.stringify({engine:engine.name(),width,fullWidthScene:true,studentsForeground:true,spatialPicking:true,zoomReset:true,sketchUndo:true,accessibility:true}));await page.close();
}}finally{await browser.close();await server.close();}
