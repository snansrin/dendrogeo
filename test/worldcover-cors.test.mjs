import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createTokenHandler} from '../supabase/functions/planetary-sas/handler.mjs';
const source=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const req=(query='',method='GET',origin='https://dendrogeo.org')=>new Request('https://project.supabase.co/functions/v1/planetary-sas'+query,{method,headers:{Origin:origin}});
test('signing bridge exposes preflight and valid cached tokens only for the fixed dataset',async()=>{
 let calls=0;const expiry=new Date(Date.now()+600000).toISOString();
 const handle=createTokenHandler({fetchImpl:async url=>{calls++;assert.equal(url,'https://planetarycomputer.microsoft.com/api/sas/v1/token/esa-worldcover');return Response.json({token:'se='+encodeURIComponent(expiry),msftExpiry:expiry});}});
 const pre=await handle(req('','OPTIONS'));assert.equal(pre.status,204);assert.equal(pre.headers.get('Access-Control-Allow-Origin'),'https://dendrogeo.org');
 for(let i=0;i<2;i++){const r=await handle(req('?collection=esa-worldcover'));assert.equal(r.status,200);assert.equal(r.headers.get('Access-Control-Allow-Origin'),'https://dendrogeo.org');assert.ok((await r.json()).token);}
 assert.equal(calls,1);
 assert.equal((await handle(req('?collection=sentinel-2-l2a'))).status,400);
 assert.equal((await handle(req('?url=https://attacker.test'))).status,400);
 assert.equal((await handle(req('','GET','https://attacker.test'))).status,403);
 assert.equal((await handle(req('','POST'))).status,405);assert.equal(calls,1);
});
test('signing failure returns a CORS-readable error and does not invent a token',async()=>{
 const handle=createTokenHandler({fetchImpl:async()=>new Response('',{status:504})});const r=await handle(req());assert.equal(r.status,502);assert.equal(r.headers.get('Access-Control-Allow-Origin'),'https://dendrogeo.org');assert.equal((await r.json()).token,undefined);
});
test('browser uses bridge credentials, never direct Microsoft signing, and fails closed on access failure',async()=>{
 let calls=0;const c=vm.createContext({fetch:async(url,options)=>{calls++;assert.match(url,/functions\/v1\/planetary-sas/);assert.equal(options.headers.apikey,'public-client-jwt');assert.equal(options.headers.Authorization,'Bearer public-client-jwt');return Response.json({token:'se='+encodeURIComponent(new Date(Date.now()+600000).toISOString())});},AbortController,Map,Date,Math,URLSearchParams,setTimeout,clearTimeout,console,SB_URL:'https://project.supabase.co',SB_KEY:'public-client-jwt',DG_LC_SAS:'https://must-not-request.test/'});
 vm.runInContext(source('src/services/lc-stac.js'),c);assert.ok(await vm.runInContext('dgLcGetSas("esa-worldcover")',c));assert.equal(calls,1);
 c.fetch=async()=>new Response('',{status:403});vm.runInContext('DG_LC_SAS_CACHE.clear()',c);await assert.rejects(vm.runInContext('dgLcGetSas("esa-worldcover")',c),/yeni analiz oluşturulmadı/);
});
test('failed new analysis removes the old surface before requesting data and does not mount stale results',async()=>{
 const order=[],nodes=new Map();const el=id=>{if(!nodes.has(id))nodes.set(id,{style:{},innerHTML:'',dataset:{},classList:{add(){},remove(){}}});return nodes.get(id);};
 const c=vm.createContext({window:{DG_LANDCOVER:{clear(){order.push('clear');},analyze:async()=>{order.push('analyze');throw Error('signing failed');}},DG_LC_SENS:{state:{record:{acceptedResult:{}}},cleanup(){order.push('cleanup');this.state.record=null;},mount(){order.push('mount');}}},PARK_POLY:[[40,32],[40,32.1],[40.1,32]],PARK_HOLES:[],document:{getElementById:el},$:el,parkAreaM2:()=>100,toast(){},dgCf:x=>x,esc:String,console:{error(){}},dgSensSave:async()=>{order.push('save');}});
 vm.runInContext(source('src/ui/park-export.js'),c);await vm.runInContext('runLandCoverAnalysis()',c);
 assert.deepEqual(order,['save','cleanup','clear','analyze']);assert.match(el('landCoverReport').innerHTML,/signing failed/);assert.equal(c.window._dgLandCoverBusy,false);
});
