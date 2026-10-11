import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createReportLandcoverRuntime} from '../scripts/lib/report-landcover-runtime.mjs';

test('boots the report runtime with the application modules in dependency order',()=>{
 const loaded=[];
 const bootLC=createReportLandcoverRuntime({read:path=>{loaded.push(path);return '';}});
 const ctx=bootLC();
 assert.equal(loaded[0],'vendor/geotiff-2.1.3.js');
 assert.equal(loaded[1],'src/utils/geo.js');
 assert.equal(loaded.at(-1),'src/services/landcover.js');
 assert.equal(loaded.length,35);
 assert.equal(ctx.window,ctx);
 assert.equal(ctx.self,ctx);
 assert.equal(ctx.location.origin,'https://rapor.local');
 assert.equal(ctx.__dgLast(),null);
 assert.throws(()=>ctx.Worker.prototype.postMessage(),/worker yolu beklenmiyor/);
});

test('report runtime loader uses the injected read function without changing module paths',()=>{
 const loaded=[];
 const bootLC=createReportLandcoverRuntime({read:path=>{loaded.push(path);return '';}});
 bootLC();
 assert.ok(loaded.includes('src/services/lc-engine.js'));
 assert.ok(loaded.includes('src/application/surface/run-analysis.js'));
 assert.equal(new Set(loaded).size,loaded.length);
});
