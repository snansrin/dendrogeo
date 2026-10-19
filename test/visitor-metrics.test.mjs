import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {PGlite} from '@electric-sql/pglite';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
function categories(){const window={};vm.runInNewContext(read('src/domain/visitors/traffic-categories.js'),{window,URL});return window.DG_TRAFFIC_CATEGORIES;}
test('traffic categories strip referrer detail, distinguish real hosts, and avoid language-based country inference',()=>{
 const api=categories();assert.equal(api.source('https://www.google.com/search?q=private','https://dendrogeo.org'),'search');assert.equal(api.source('https://google.com.evil.test/','https://dendrogeo.org'),'referral');assert.equal(api.source('https://chatgpt.com/c/private','https://dendrogeo.org'),'ai');assert.equal(api.source('https://t.me/private','https://dendrogeo.org'),'telegram');assert.equal(api.source('https://dendrogeo.org/yontem/','https://dendrogeo.org'),'internal');assert.equal(api.source('','https://dendrogeo.org'),'direct');assert.equal(api.page('/rapor/DGR-2026-0019/'),null);assert.equal(api.device('Macintosh',5),'tablet');assert.equal(api.device('Mozilla Android Mobile'),'phone');
});
test('site events carry only coarse categories and honor privacy preferences and test browsers',()=>{
 const sent=[],listeners={},window={location:{hostname:'dendrogeo.org',pathname:'/',search:'?code=private',hash:'#secret'},navigator:{userAgent:'Desktop',maxTouchPoints:0,onLine:true},document:{referrer:'https://www.google.com/?q=private',readyState:'complete',addEventListener:(key,value)=>listeners[key]=value},DG_TRAFFIC_CATEGORIES:categories(),DG_SITE_TRAFFIC_CONFIG:{url:'counter',key:'public'},DG_SEND_SITE_METRIC:{send:(_config,payload)=>{sent.push(payload);return Promise.resolve(true);}}};
 vm.runInNewContext(read('src/bootstrap/site-traffic.js'),{window});window.DG_SITE_TRAFFIC.workspace('map');window.DG_SITE_TRAFFIC.workspace('map');window.DG_SITE_TRAFFIC.workspace('visitors');listeners.click({target:{closest:()=>({disabled:false})}});
 assert.equal(sent.length,3);assert.deepEqual(Object.keys(sent[0]).sort(),['device','event','page','source']);assert.ok(!JSON.stringify(sent).includes('private'));assert.equal(sent[1].event,'workspace_open');assert.equal(sent[2].event,'analysis_request');
 window.navigator.globalPrivacyControl=true;window.DG_SITE_TRAFFIC.workspace('measure');assert.equal(sent.length,3);window.navigator.globalPrivacyControl=false;window.navigator.doNotTrack='1';window.DG_SITE_TRAFFIC.workspace('projects');assert.equal(sent.length,3);window.navigator.doNotTrack=null;window.navigator.webdriver=true;window.DG_SITE_TRAFFIC.workspace('records');assert.equal(sent.length,3);
});
test('daily aggregate RPCs enforce service-only writes, owner-only reads, exact totals and retention',async()=>{
 const db=new PGlite();try{
  await db.exec("create role anon;create role authenticated;create role service_role bypassrls;create schema private;grant usage on schema private to authenticated;create function private.is_owner() returns boolean language sql stable as $$select coalesce(current_setting('test.owner',true),'false')='true'$$;");
  await db.exec(read('supabase/migrations/20261019092224_visitor_daily_aggregate_metrics.sql'));
  await db.exec('set role anon');await assert.rejects(db.query("select public.record_site_metric_v1('page_view','home','search','phone','TR')"),/permission denied/);await assert.rejects(db.query('select * from public.site_metric_daily'),/permission denied/);await db.exec('reset role;set role service_role');
  for(let i=0;i<3;i++)await db.query("select public.record_site_metric_v1('page_view','home','search','phone','TR')");await db.query("select public.record_site_metric_v1('workspace_open','app-map','direct','desktop','ZZ')");
  await assert.rejects(db.query("select public.record_site_metric_v1('private-event','home','search','phone','TR')"),/check constraint/);
  await db.exec("insert into public.site_metric_daily values(current_date-500,'page_view','home','direct','desktop','ZZ',10)");await db.query("select public.record_site_metric_v1('analysis_request','app-map','direct','desktop','ZZ')");
  await db.exec("reset role;set role authenticated;set test.owner='false'");assert.equal((await db.query('select * from public.site_metric_daily')).rows.length,0);await assert.rejects(db.query('select public.get_site_metrics_v1(1)'),/Owner access required/);
  await db.exec("set test.owner='true'");const result=(await db.query('select public.get_site_metrics_v1(1) as data')).rows[0].data;assert.equal(result.totals.page_views,3);assert.equal(result.totals.workspace_opens,1);assert.equal(result.totals.analysis_requests,1);assert.deepEqual(result.countries,[{key:'TR',total:3}]);assert.equal(result.timezone,'Europe/Istanbul');assert.equal((await db.query('select * from public.site_metric_daily where day<current_date-400')).rows.length,0);await assert.rejects(db.query('select public.get_site_metrics_v1(365)'),/Unsupported reporting range/);
 }finally{await db.close();}
});
test('usage panel is inaccessible to nonowners before any database read',async()=>{
 const listeners={},window={document:{addEventListener:(name,fn)=>listeners[name]=fn,getElementById:()=>{throw Error('nonowner must not read the panel');}}};const context=vm.createContext({window,PROFILE:{role:'user'}});vm.runInContext(read('src/bootstrap/visitor-analytics.js'),context);await window.DG_VISITOR_ANALYTICS_PANEL.load();
});
