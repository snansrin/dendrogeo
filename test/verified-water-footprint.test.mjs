import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import polygonClipping from 'polygon-clipping';

const src=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
function setup(){
 const elements=new Map(),el=id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',style:{},value:'',querySelectorAll:()=>[]});return elements.get(id);};
 const ctx=vm.createContext({window:{polygonClipping},crypto:webcrypto,TextEncoder,URLSearchParams,Date,setTimeout,clearTimeout,console,document:{getElementById:el,querySelectorAll:()=>[]},esc:String,dgCf:s=>s,toast(){},USER:{id:'user-a'},DG_PARK:{id:25,name:'Göksu Parkı'},DG_PARK_SESSION:new Map(),PARK_POLY:[],PARK_HOLES:[],map:{removeLayer(){},closePopup(){}},sb:{}});
 for(const p of ['src/core/surface-display.js','src/services/lc-config.js','src/services/lc-geo.js','src/services/lc-validate.js','src/services/lc-s2.js','src/contracts/surface-review.js','src/domain/surface/review-geometry.js','src/services/lc-review.js','src/ui/editor-ui.js','src/ui/lc-sens.js'])vm.runInContext(src(p),ctx);
 const run=s=>vm.runInContext(s,ctx);
 run('DG_SENS.record=dgSensNewRecord()');
 const epsg=32631,point=(x,y)=>{const p=run('dgLcUtmInverse('+(500000+x)+','+(1000+y)+','+epsg+')');return[p.lon,p.lat];};
 const rect=(x0,y0,x1,y1)=>[point(x0,y0),point(x1,y0),point(x1,y1),point(x0,y1)];
 const outer=rect(0,0,20,10).map(p=>[p[1],p[0]]);ctx.PARK_POLY=[outer];
 const park=run('dgSurfacePark(PARK_POLY,[],32631)'),cells=[0,1].map(i=>({row:0,col:i,epsg,classKey:'water',rasterClassKey:'water',areaM2:100,quadWgs:rect(i*10,0,(i+1)*10,10),center:{lat:point(i*10+5,5)[1],lon:point(i*10+5,5)[0]}}));
 ctx.park=park;ctx.cells=cells;ctx.geoms={};
 for(const c of cells)ctx.geoms['0:'+c.col]=ctx.window.DG_SURFACE_REVIEW.cell(c,park,epsg);
 run('DG_LC_LAST={result:{cells,groupAreas:{green:0,water:200,hard:0,bare:0,other:0}},report:{year:2021}};DG_SENS.geometry=geoms;DG_SENS.parkGeometry=park;DG_SENS.epsg=32631');
 const boundary=rect(2,2,8,8);boundary.push([...boundary[0]]);
 ctx.boundary=boundary;
 run('DG_SENS.record.objectFeatures=[{type:"water",method:"osm-boundary",osmId:"way/423602740",geometry:{type:"MultiPolygon",coordinates:[[boundary]]}}]');
 return {run,ctx};
}

test('validated lake polygon replaces spilled raster water outside the true shoreline',()=>{
 const a=setup();
 a.run('DG_SENS.record.profile={cells:{"0:0":{obs:4,ndvi:.62,mndwi:.02,ndbi:-.1,ndviMaxYear:.68},"0:1":{obs:4,ndvi:.62,mndwi:.02,ndbi:-.1,ndviMaxYear:.68}}}');
 assert.equal(a.run('dgSensHasVerifiedWaterBoundary()'),true);
 const areas=a.run('dgSensAreas()');
 assert.ok(Math.abs(areas.water-36)<.02,'Vector-defined water area must be 36 m²');
 assert.ok(Math.abs(areas.green-164)<.02,'Supported land should replace the spilled pixels');
 assert.equal(a.run('DG_LC_LAST.result.cells.every(c=>c.rasterClassKey==="water")'),true,'Raw WorldCover remains unchanged');
 assert.equal(a.run('dgSensWaterBoundaryUnresolved()'),0);
});

test('unverified water ways cannot silently erase park raster water',()=>{
 const a=setup();
 a.run('DG_SENS.record.objectFeatures[0].osmId="way/123";DG_SENS.visualVersion++');
 assert.equal(a.run('dgSensHasVerifiedWaterBoundary()'),false);
 assert.ok(Math.abs(a.run('dgSensAreas().water')-200)<.02);
});

test('OSM opt-out reverts to raw water preview',()=>{
 const a=setup();
 a.run('DG_SENS.record.useObjects=false;DG_SENS.visualVersion++');
 assert.equal(a.run('dgSensHasWaterFootprint()'),false);
 assert.equal(a.run('dgSensEffective(cells[0])'),'water');
});

test('unobserved spill cells are flagged and cannot be accepted',async()=>{
 const a=setup();
 assert.equal(a.run('dgSensWaterBoundaryUnresolved()'),2);
 assert.equal(await a.run('dgSensAccept()'),false);
 assert.match(a.run('DG_SENS.status'),/2 raster-su hücresi/);
});
