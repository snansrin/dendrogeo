import {test} from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
function app(){const els=new Map(),ctx=vm.createContext({console,Date,setTimeout,clearTimeout,setInterval,clearInterval,navigator:{userAgent:'QA'},sessionStorage:{getItem(){return'qa'}},localStorage:{getItem(){return null}},window:{},PROFILE:{role:'owner'},document:{hidden:false},$:id=>els.get(id)||null,esc:String});vm.runInContext(readFileSync(new URL('../src/application/visitors/build-live-activity.js',import.meta.url),'utf8'),ctx);vm.runInContext(readFileSync(new URL('../src/application/visitors/build-live-roster.js',import.meta.url),'utf8'),ctx);vm.runInContext(readFileSync(new URL('../src/application/visitors/record-live-session-events.js',import.meta.url),'utf8'),ctx);vm.runInContext(readFileSync(new URL('../src/application/visitors/build-stored-activity.js',import.meta.url),'utf8'),ctx);vm.runInContext(readFileSync(new URL('../src/ui/visitor-activity-feed.js',import.meta.url),'utf8'),ctx);ctx.DG_VISITOR_ACTIVITY_FEED_UI=ctx.window.DG_VISITOR_ACTIVITY_FEED_UI;vm.runInContext(readFileSync(new URL('../src/ui/visitor-database-activity.js',import.meta.url),'utf8'),ctx);ctx.DG_VISITOR_DATABASE_ACTIVITY_UI=ctx.window.DG_VISITOR_DATABASE_ACTIVITY_UI;vm.runInContext(readFileSync(new URL('../src/services/visit-stats.js',import.meta.url),'utf8'),ctx);return{ctx,els,run:s=>vm.runInContext(s,ctx)};}
test('presence deduplicates users and removes expired sessions',()=>{const a=app(),now=Date.now();a.ctx.state={u:[{id:'a',n:'Old',t:now-20000},{id:'a',n:'Latest',t:now-1000}],v:[{id:'b',t:now-121000},{id:'c',t:now-1000}]};a.run('dgPresenceList=()=>state');const rows=a.run('dgVisRows()');assert.equal(rows.length,2);assert.equal(rows[0].p.n,'Latest');});
test('visitor filters search, active screen and valid location together',()=>{const a=app();a.els.set('visSearch',{value:'sinan'});a.els.set('visViewFilter',{value:'nav'});a.els.set('visLocated',{checked:true});a.ctx.rows=[{p:{n:'Sinan',v:'nav',la:39,lo:32}},{p:{n:'Sinan',v:'map',la:39,lo:32}},{p:{n:'Sinan',v:'nav',la:null,lo:null}}];assert.equal(a.run('dgVisFilter(rows)').length,1);assert.equal(a.run('dgVisHasLocation({la:"bad",lo:32})'),false);});
test('non-owner refresh does not read data or create a live map',async()=>{const a=app();let reads=0;a.ctx.sb={from(){reads++;throw Error('unexpected')}};a.ctx.PROFILE.role='user';await a.run('dgVisRefresh()');assert.equal(reads,0);assert.equal(a.run('DG_VIS_MAP'),null);});
test('connected background sessions remain visible despite heartbeat throttling',()=>{const a=app();a.ctx.state={u:[{id:'background',t:Date.now()-300000,hidden:true}]};a.run('DG_PRES_OK=true;dgPresenceList=()=>state');assert.equal(a.run('dgVisRows().length'),1);a.run('DG_PRES_OK=false');assert.equal(a.run('dgVisRows().length'),0);});
test('an old channel error cannot drop a resumed connection; tracking failures are visible',async()=>{const a=app(),channels=[];a.ctx.USER={id:'qa'};a.ctx.sb={channel(){const channel={on(){return this},subscribe(callback){this.notify=callback;return this},track:async()=>"ok",presenceState:()=>({})};channels.push(channel);return channel;},removeChannel:async()=>{},auth:{getSession:async()=>({data:{}})}};a.run('dgPresenceStart()');channels[0].notify('SUBSCRIBED');a.run('dgPresenceStop();dgPresenceStart()');channels[1].notify('SUBSCRIBED');channels[0].notify('CHANNEL_ERROR');assert.equal(a.run('dgPresenceState()'),'on');channels[1].track=async()=>"timed out";a.run('dgPresencePing(null,true)');await new Promise(r=>setTimeout(r,0));assert.equal(a.run('dgPresenceState()'),'error');a.run('dgPresenceStop()');});

test('quick live filters reuse the same search/view/location controls',()=>{
 const a=app();
 a.els.set('visSearch',{value:'sinan'});
 a.els.set('visViewFilter',{value:''});
 a.els.set('visLocated',{checked:false});
 a.ctx.renderVisitorsLive=()=>{};
 a.run("dgVisQuick('nav',true)");
 assert.equal(a.els.get('visSearch').value,'');
 assert.equal(a.els.get('visViewFilter').value,'nav');
 assert.equal(a.els.get('visLocated').checked,true);
});

test('live activity keeps translated presence events newest-first and caps output',()=>{
 const a=app(),rows=[{p:{n:'Ada',st:100,vh:[{v:'map',t:300}],act:{k:'save',t:200,d:'tree 1'}}}];
 a.ctx.rows=rows;
 const events=a.run('DG_VISITOR_ACTIVITY.build(rows,{viewLabels:DG_VIEW_LABELS,actionLabels:DG_ACT_LABELS,translate:value=>"tr:"+value,maxItems:2})');
 assert.deepEqual(Array.from(events,e=>[e.t,e.k,e.d]),[[300,'tr:görüntüledi','tr:Canlı Harita'],[200,'tr:ölçüm kaydetti','tree 1']]);
});

test('live activity feed keeps escaped event content, local-time rendering and empty state',()=>{
 const a=app(),box={innerHTML:'',textContent:''};
 a.els.set('visFeed',box);
 a.ctx.esc=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
 a.ctx.dgCf=value=>value==='—'?'empty':value;
 a.run('dgVisFeed([{p:{n:"<Ada>",act:{t:0,k:"save",d:"<park>"}}}])');
 assert.match(box.innerHTML,/<b style="flex:0 0 auto">&lt;Ada&gt;<\/b>/);
 assert.match(box.innerHTML,/&lt;park&gt;/);
 assert.match(box.innerHTML,/class="mono"/);
 a.run('dgVisFeed([])');
 assert.equal(box.textContent,'empty');
});

test('stored visitor activity remains owner-only, sorted, escaped and rendered by the UI module',async()=>{
 const a=app(),box={innerHTML:'',textContent:''},queries=[];
 a.els.set('visActivity',box);
 a.ctx.PROFILE={role:'owner'};
 a.ctx.dgCf=value=>value;
 a.ctx.esc=value=>String(value).replaceAll('<','&lt;').replaceAll('>','&gt;');
 const datasets={measurements:[{id:1,point_id:2,species:'<Oak>',status:'measured',created_at:'2026-10-12T11:00:00Z',profiles:{full_name:'<Ada>'}}],projects:[],data_requests:[],report_requests:[]};
 a.ctx.sb={from(table){queries.push(table);return{select(){return this;},order(){return this;},limit(){return Promise.resolve({data:datasets[table]});}};}};
 await a.run('dgVisActivity()');
 assert.deepEqual(queries,['measurements','projects','data_requests','report_requests']);
 assert.match(box.innerHTML,/&lt;Ada&gt;/);
 assert.match(box.innerHTML,/&lt;Oak&gt;/);
 assert.match(box.innerHTML,/class="mono" style="white-space:nowrap"/);
});

test('presence payload keeps bounded view/action/location metadata transient',async()=>{
 const a=app(),payloads=[];
 a.ctx.USER={id:'qa'};a.ctx.PROFILE={role:'owner',full_name:'QA'};
 a.ctx.GPS={latitude:39,longitude:32};a.ctx.window.payloads=payloads;
 a.run('DG_PRES_OK=true;DG_PRES={track:p=>{window.payloads.push(p);return Promise.resolve("ok")}};dgPresenceView("map");dgPresenceView("map");GPS.latitude=39.001;dgPresenceView("nav");dgPresenceAct("save","'+('x'.repeat(70))+'")');
 await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(payloads.length,3);
 const last=payloads.at(-1);
 assert.deepEqual(Array.from(last.vh,event=>event.v),['map','nav']);
 assert.deepEqual(Array.from(last.lh,point=>[Number(point[0]),Number(point[1])]),[[39,32],[39.001,32]]);
 assert.equal(last.act.k,'save');assert.equal(last.act.d.length,60);
 assert.equal(a.run('DG_VISITOR_SESSION_EVENTS.snapshot().views.length'),2);
});
