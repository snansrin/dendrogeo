/* Exercise the shipped Supabase SDK over intercepted HTTP, without live credentials or data. */
import assert from 'node:assert/strict';
import {serveFixture} from './lib/browser-acceptance-fixture.mjs';
import {loadChromium} from './lib/playwright-runtime.mjs';
const server=await serveFixture(),engine=process.env.DG_UI_BROWSER==='webkit'?(await import('playwright-core')).webkit:await loadChromium();
const browser=await engine.launch({headless:true});
const user={id:'11111111-1111-4111-8111-111111111111',aud:'authenticated',role:'authenticated',email:'member@example.test',email_confirmed_at:'2026-10-01T00:00:00Z',app_metadata:{provider:'email'},user_metadata:{},identities:[],created_at:'2026-10-01T00:00:00Z'};
const owner='22222222-2222-4222-8222-222222222222';
const jwt=()=>[Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({sub:user.id,role:'authenticated',email:user.email,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'fixture-signature'].join('.');
try{for(const width of [360,390,430,1280]){
 const context=await browser.newContext({viewport:{width,height:950},serviceWorkers:'block'}),page=await context.newPage();
 let failAuth=true,authRequests=0;const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(({user,token})=>localStorage.setItem('sb-xjbpounwdxrhelmixvqm-auth-token',JSON.stringify({access_token:token,refresh_token:'fixture-refresh',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user})),{user,token:jwt()});
 await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,route=>route.abort());
 await page.routeWebSocket(/supabase\.co/,socket=>socket.close());
 await page.route('https://xjbpounwdxrhelmixvqm.supabase.co/**',async route=>{
  const url=new URL(route.request().url()),path=url.pathname;
  const respond=(data,status=200)=>route.fulfill({status,contentType:'application/json',headers:{'access-control-allow-origin':'*','content-range':'0-0/1'},body:JSON.stringify(data)});
  if(path==='/auth/v1/user'){authRequests++;return failAuth?respond({code:'unexpected_failure',msg:'Fixture Auth temporarily unavailable'},503):respond(user);}
  if(path.includes('/realtime/'))return respond({},503);
  if(path.startsWith('/rest/v1/rpc/'))return respond([]);
  const table=path.split('/').at(-1);
  if(table==='profiles')return respond({id:user.id,email:user.email,full_name:'SDK fixture',role:'user',active:true});
  if(table==='v_my_parks')return respond([{id:25,name:'Shared Park',role:'collaborator'}]);
  if(table==='park_collaborators')return respond([{park_id:25,user_id:user.id,added_at:'2026-11-01T12:00:00Z'}]);
  if(table==='park_invites')return respond(url.searchParams.get('status')==='eq.Kabul'?[{park_id:25,invited_by:owner,responded_at:'2026-11-01T12:00:00Z'}]:[]);
  if(table==='projects')return respond(url.searchParams.has('owner')?[{id:10,owner:user.id,name:'My own project',park_id:7,parks:{id:7,name:'Own Park'}}]:[{id:30,owner,name:'Shared project',park_id:25,is_locked:true,parks:{id:25,name:'Shared Park'}}]);
  return respond([]);
 });
 await page.goto(server.url);await page.waitForFunction(()=>document.getElementById('dgStartupScreen').hidden);
 await page.evaluate(()=>window._dgShellViewData.start());
 assert.ok(authRequests>0,'real SDK must make the Auth HTTP read');
 assert.equal(await page.locator('#projOwnList .project-card').count(),1,'first-load shared Auth failure must not hide owned rows');
 assert.equal(await page.locator('#mProject').inputValue(),'10');
 assert.equal(await page.evaluate(()=>DG_MEASUREMENT_PROJECT_DIRECTORY_STATE.getState().error.failures[0].source),'shared');
 failAuth=false;
 await page.locator('#side [data-dg-view="projects"]').click();await page.evaluate(()=>window._dgShellViewData.load('projects'));
 assert.equal(await page.locator('#projOwnList .project-card').count(),1);
 assert.equal(await page.locator('#projSharedList .project-card').count(),1,'real SDK raw user response recovers shared rows');
 assert.equal(await page.locator('#mProject option[value="30"]').isDisabled(),true,'server project lock stays intact');
 assert.equal(await page.evaluate(()=>DG_MEASUREMENT_PROJECT_DIRECTORY_STATE.getState().error),null);
 await page.locator('#side [data-dg-view="measure"]').click();
 assert.equal(await page.locator('#v-measure').evaluate(e=>e.classList.contains('on')),true);
 assert.equal(await page.evaluate(()=>PARK_MODE),false);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({engine:engine.name(),width,realSupabaseSdk:true,initialAuthFailureOwnedVisible:true,sharedRecovered:true,locksUnchanged:true,noAutomaticScan:true}));
 await context.close();
}}finally{await browser.close();await server.close();}
