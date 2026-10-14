import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadChromium} from './lib/playwright-runtime.mjs';
const browser=await(await loadChromium()).launch({headless:true});
try{
 const page=await browser.newPage();
 for(const path of ['src/domain/parks/build-osm-surface-query.js','src/domain/parks/decode-osm-map-geometry.js','src/adapters/parks/load-osm-map-coverage.js'])await page.addScriptTag({content:readFileSync(path,'utf8')});
 const result=await page.evaluate(async()=>{
  const xml='<osm><node id="1" lat="39" lon="32"/><node id="2" lat="39.001" lon="32"/><node id="3" lat="39.001" lon="32.001"/><way id="10"><nd ref="1"/><nd ref="2"/><nd ref="3"/><nd ref="1"/><tag k="building" v="yes"/></way><relation id="20"><member type="way" ref="11" role="outer"/><tag k="natural" v="water"/><tag k="type" v="multipolygon"/></relation></osm>';
  const full='<osm><node id="4" lat="39" lon="32"/><node id="5" lat="39.002" lon="32"/><node id="6" lat="39.002" lon="32.002"/><way id="11"><nd ref="4"/><nd ref="5"/><nd ref="6"/><nd ref="4"/></way><relation id="20"><member type="way" ref="11" role="outer"/><tag k="natural" v="water"/><tag k="type" v="multipolygon"/></relation></osm>';
  let calls=0;const create=fetch=>DG_LOAD_OSM_MAP_COVERAGE.create({fetch,relevant:DG_OSM_SURFACE_QUERY.relevant,decode:DG_DECODE_OSM_MAP_GEOMETRY.decode});
  const load=create(async url=>{calls++;return{ok:true,text:async()=>url.includes('/full')?full:xml}}),data=await load('39,32,39.003,32.003');await load('39,32,39.003,32.003');
  const invalid=create(async()=>({ok:true,text:async()=>'<osm><way id="10"><nd ref="404"/><tag k="building" v="yes"/></way></osm>'}));
  return{calls,complete:data.complete,source:data.source,buildingVertices:data.elements[0].geometry.length,waterVertices:data.elements[1].members[0].geometry.length,invalid:await invalid('39,32,39.003,32.003'),large:await load('30,30,40,40')};
 });
 assert.deepEqual(result,{calls:2,complete:true,source:'osm-api',buildingVertices:4,waterVertices:4,invalid:null,large:null});console.log('Native XML, complete relation recovery, cache and incomplete-response rejection passed');
 if(process.argv.includes('--live')){
  // Only small read-only scopes; no credentials or user records are accessed.
  for(const bounds of ['39.988,32.647,39.992,32.653','39.94,32.847,39.95,32.862','39.898,32.858,39.904,32.865']){
   const [south,west,north,east]=bounds.split(',');const response=await fetch('https://api.openstreetmap.org/api/0.6/map?bbox='+[west,south,east,north].join(','),{headers:{Accept:'application/xml','User-Agent':'DendroGeo-QA/3.0 (https://dendrogeo.org)'},signal:AbortSignal.timeout(20000)});assert.equal(response.ok,true);const text=await response.text();
   const data=await page.evaluate(async({text,bounds})=>{
    const load=DG_LOAD_OSM_MAP_COVERAGE.create({fetch:async url=>{if(url.includes('/map?'))return{ok:true,text:async()=>text};const r=await fetch(url);return r},relevant:DG_OSM_SURFACE_QUERY.relevant,decode:DG_DECODE_OSM_MAP_GEOMETRY.decode});
    const data=await load(bounds);return data?{complete:data.complete,source:data.source,count:data.elements.length,buildings:data.elements.filter(e=>e.tags?.building).length,roads:data.elements.filter(e=>e.tags?.highway).length,water:data.elements.filter(e=>e.tags?.water||e.tags?.natural==='water').length}:null;
   },{text,bounds});assert.ok(data?.complete);console.log(JSON.stringify({bounds,...data}));
  }
 }
}finally{await browser.close();}
