import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {serveFixture,isolateAccount} from './lib/browser-acceptance-fixture.mjs';
import {loadChromium} from './lib/playwright-runtime.mjs';
const fixture=JSON.parse(readFileSync('test/fixtures/harikalar-diyari-park.json','utf8'));
const nodes=fixture.ring.slice(0,-1),xml='<osm>'+nodes.map(([lat,lon],i)=>`<node id="${i+1}" lat="${lat}" lon="${lon}"/>`).join('')+'<way id="205225595">'+[...nodes.map((_,i)=>i+1),1].map(id=>`<nd ref="${id}"/>`).join('')+'<tag k="leisure" v="park"/><tag k="name" v="Harikalar Diyarı"/></way></osm>';
const engine=process.env.DG_UI_BROWSER==='webkit'?(await import('playwright-core')).webkit:await loadChromium();
const server=await serveFixture(),browser=await engine.launch({headless:true});
try{const page=await browser.newPage({viewport:{width:390,height:900},serviceWorkers:"block"}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await isolateAccount(page);await page.route('https://**/api/interpreter',route=>route.fulfill({status:503,body:'unavailable'}));await page.route('https://nominatim.openstreetmap.org/**',route=>route.abort());
 let nativeCalls=0;await page.route('https://api.openstreetmap.org/api/0.6/map?*',route=>{nativeCalls++;return route.fulfill({contentType:'application/xml',body:xml});});
 await page.goto(server.url);await page.waitForFunction(()=>document.getElementById('dgStartupScreen').hidden);
 const result=await page.evaluate(async()=>{const parks=await queryPark(39.980497,32.5915895);const again=await queryPark(39.980497,32.5915895);return{parks,again:again.map(p=>p.id)};});
 assert.equal(result.parks[0].id,205225595);assert.equal(result.parks[0].boundaryProvider,'osm-api');assert.equal(result.parks[0].rings.length,1);assert.deepEqual(result.parks[0].rings[0],fixture.ring);assert.deepEqual(result.again,[205225595]);assert.equal(nativeCalls,1,'full boundary cache prevents repeated native requests');assert.deepEqual(errors,[]);
 console.log(JSON.stringify({engine:engine.name(),overpassUnavailable:true,nominatimUnavailable:true,harikalarBoundaryComplete:true,vertices:fixture.ring.length,nativeRequests:nativeCalls}));
}finally{await browser.close();await server.close();}
