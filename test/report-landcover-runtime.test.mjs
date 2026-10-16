import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createReportLandcoverRuntime} from '../scripts/lib/report-landcover-runtime.mjs';
import {readFileSync} from 'node:fs';
import {surfaceRuntimeModules} from '../scripts/lib/surface-runtime-modules.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const mockRead=loaded=>path=>{if(path==='src/utils/lazylibs.js')return read(path);loaded.push(path);return '';};

test('boots the report runtime with the application modules in dependency order',()=>{
 const loaded=[];
 const bootLC=createReportLandcoverRuntime({read:mockRead(loaded)});
 const ctx=bootLC();
 assert.equal(loaded[0],'vendor/geotiff-2.1.3.js');
 assert.equal(loaded[1],'src/utils/geo.js');
 assert.equal(loaded.at(-1),'src/services/landcover.js');
 assert.equal(loaded.length,15+surfaceRuntimeModules(read).length);
 assert.deepEqual(loaded.slice(15),surfaceRuntimeModules(read));
 assert.equal(ctx.window,ctx);
 assert.equal(ctx.self,ctx);
 assert.equal(ctx.location.origin,'https://rapor.local');
 assert.equal(ctx.__dgLast(),null);
 assert.throws(()=>ctx.Worker.prototype.postMessage(),/worker yolu beklenmiyor/);
});

test('report runtime loader uses the injected read function without changing module paths',()=>{
 const loaded=[];
 const bootLC=createReportLandcoverRuntime({read:mockRead(loaded)});
 bootLC();
 assert.ok(loaded.includes('src/services/lc-engine.js'));
 assert.ok(loaded.includes('src/application/surface/run-analysis.js'));
 assert.equal(new Set(loaded).size,loaded.length);
});

test('real modular runtime boots and invokes STAC transport and projection without missing adapters',async()=>{
 const ctx=createReportLandcoverRuntime({read})();
 assert.equal(typeof ctx.dgLcAnalyze,'function');assert.equal(typeof ctx.dgS2Profile,'function');
 assert.equal(typeof ctx.dgValStratifiedSample,'function');assert.equal(typeof ctx.DG_GRID_SESSION_STATE.create,'function');
 const geometry=ctx.dgLcProjectGeometry([[[40,32],[40,32.001],[40.001,32.001],[40,32]]],[],32636);
 assert.ok(ctx.dgLcProjectedArea(geometry)>0);
 let requested=false;
 const result=await ctx.DG_STAC_FETCH_POLICY.fetchJson('https://fixture.invalid',{},async()=>{requested=true;return new Response('{"features":[]}',{status:200});});
 assert.equal(requested,true);assert.equal(result.features.length,0);
});

test('canonical chain parser rejects missing, duplicate and executable module lists',()=>{
 for(const source of ['',"const DG_LULC_CHAIN=['src/a.js','src/a.js'];","const DG_LULC_CHAIN=makePaths();","const DG_LULC_CHAIN=['../a.js'];"]){assert.throws(()=>surfaceRuntimeModules(()=>source));}
});
