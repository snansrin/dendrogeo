import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {loadChromium} from './lib/playwright-runtime.mjs';
const root=resolve('.'),panel=readFileSync('src/ui/park-panel.js','utf8'),exports=readFileSync('src/ui/park-export.js','utf8');
const draw=panel.slice(panel.indexOf('async function drawPark('),panel.indexOf('const DG_PARK_RESET_CONTROLLER=')),download=exports.slice(exports.indexOf('function downloadBlob('),exports.indexOf('function downloadGridGeoJSON('));
const paths=['vendor/leaflet-1.9.4.js','src/domain/parks/normalize-drawn-park-geometry.js','src/application/parks/draw-selected-park.js','src/ui/present-drawn-park.js','src/ui/park-boundary-layer.js','src/ui/park-candidate-select.js','src/ui/park-info-panel.js','src/adapters/export/download-blob.js'];
const fixture='<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/vendor/leaflet-1.9.4.css"><link rel="stylesheet" href="/css/style.css"><link rel="stylesheet" href="/css/park-panel.css"><style>body{margin:0}#map{height:450px}#parkInfo{padding:10px;box-sizing:border-box}</style><div id="map"></div><div id="parkInfo"></div>'+paths.map(p=>'<script src="/'+p+'"></script>').join('')+`<script>
const map=L.map('map').setView([39.99,32.65],16),$=id=>document.getElementById(id),esc=s=>String(s).replace(/</g,'&lt;');
let PARK_SELECTED_AREA_M2=null,PARK_POLY=null,PARK_HOLES=[],PARK_LAYER=null,PARK_CANDS=[],DG_PARK_DRAW_EPOCH=0,pendingCoverage=null;const messages=[];
function clearPark(){if(PARK_LAYER)map.removeLayer(PARK_LAYER);PARK_LAYER=null;PARK_POLY=null;PARK_HOLES=[]}function clearGrid(){}
function dgOnParkDrawn(park){return Promise.resolve({id:7,name:park.name})}function queryDetailedCoverage(){return pendingCoverage||Promise.resolve(true)}function parkAreaHa(){return 56.9}
function dgParkIdChip(row){return row?'#'+row.id:''}function dgProjectOptionsForPark(){return ''}function dgParkMountMenus(){}function renderRefBadge(){}function toast(...args){messages.push(args)}
${draw}
${download}
window.fixturePark=name=>({name,area:569000,rings:{outer:[[[39.99,32.65],[39.99,32.66],[40,32.66],[39.99,32.65]]],inner:[[[39.992,32.652],[39.992,32.654],[39.994,32.654],[39.992,32.652]]]}});
</script>`;
const server=createServer((req,res)=>{if(req.url==='/fixture'){res.setHeader('Content-Type','text/html');res.end(fixture);return;}const p=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!p.startsWith(root+'/')&&!p.startsWith(root+'\\')){res.writeHead(403).end();return;}try{res.setHeader('Content-Type',extname(p)==='.css'?'text/css':'text/javascript');res.end(readFileSync(p));}catch(error){res.writeHead(404).end();}});
await new Promise(r=>server.listen(8768,'127.0.0.1',r));const browser=await(await loadChromium()).launch({headless:true});
try{for(const width of [360,390,430,1280]){const page=await browser.newPage({viewport:{width,height:840}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:8768/fixture');
await page.evaluate(()=>drawPark(fixturePark('First park')));assert.ok((await page.locator('#parkInfo').innerText()).includes('First park'));assert.equal(await page.evaluate(()=>PARK_HOLES.length),1);assert.equal(await page.evaluate(()=>map.hasLayer(PARK_LAYER)),true);
await page.evaluate(async()=>{let release;pendingCoverage=new Promise(r=>release=r);const old=drawPark(fixturePark('Old park'));pendingCoverage=null;await drawPark(fixturePark('Current park'));release(true);await old});const text=await page.locator('#parkInfo').innerText();assert.ok(text.includes('Current park'));assert.ok(!text.includes('Old park'));
const downloading=page.waitForEvent('download');await page.evaluate(()=>downloadBlob('fixture.csv','text/csv;charset=utf-8','DATA'));const file=await downloading;assert.equal(file.suggestedFilename(),'fixture.csv');assert.equal(readFileSync(await file.path(),'utf8'),'DATA');
assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);console.log(JSON.stringify({width,boundary:true,holes:true,currentParkCard:true,lateResponseRejected:true,nativeDownload:true}));await page.close();}}
finally{await browser.close();await new Promise(r=>server.close(r));}
