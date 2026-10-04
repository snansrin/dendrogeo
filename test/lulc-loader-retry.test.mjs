import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const root=new URL('../',import.meta.url);
test('interrupted classic-script chain resumes without redeclaring loaded const/let modules',async()=>{
 const loaded=[],executed=new Set();let fail=true;
 const ctx={window:null,document:{readyState:'loading',getElementById(){return null;},addEventListener(){},createElement(){return {};},head:{appendChild(s){
  queueMicrotask(()=>{
   const path=s.src.split('?')[0];loaded.push(path);
   if(path==='src/services/lc-engine.js'&&fail){fail=false;s.onerror();return;}
   if(executed.has(path))throw new Error('Classic module executed twice: '+path);
   executed.add(path);
   if(path==='src/services/landcover.js')ctx.DG_LANDCOVER={};
   s.onload();
  });
 }}},console,encodeURIComponent};ctx.window=ctx;vm.createContext(ctx);
 vm.runInContext(readFileSync(new URL('src/utils/lazylibs.js',root),'utf8'),ctx);
 const a=ctx.dgEnsureLulc(),b=ctx.dgEnsureLulc();assert.equal(a,b);
 await assert.rejects(a,/lc-engine/);await ctx.dgEnsureLulc();
 assert.equal(loaded.filter(x=>x==='src/services/lc-config.js').length,1);
 assert.equal(loaded.filter(x=>x==='src/services/lc-engine.js').length,2);
 assert.equal(loaded.filter(x=>x==='src/services/landcover.js').length,1);
 await ctx.dgEnsureLulc();assert.equal(loaded.length,executed.size+1);
});
