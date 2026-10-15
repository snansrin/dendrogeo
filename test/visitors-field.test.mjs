import {test} from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync,readdirSync} from 'node:fs';
function app(){const els=new Map(),ctx=vm.createContext({console,Date,setTimeout,clearTimeout,setInterval,clearInterval,navigator:{userAgent:'QA'},sessionStorage:{getItem(){return'qa'}},localStorage:{getItem(){return null}},window:{},PROFILE:{role:'owner'},document:{hidden:false,addEventListener(){},getElementById:id=>els.get(id)||null},$:id=>els.get(id)||null,esc:String});ctx.window=ctx;vm.runInContext(readFileSync(new URL('../src/domain/visitors/device-label.js',import.meta.url),'utf8'),ctx);vm.runInContext(readFileSync(new URL('../src/application/visitors/build-live-activity.js',import.meta.url),'utf8'),ctx);vm.runInContext(readFileSync(new URL('../src/application/visitors/build-live-roster.js',import.meta.url),'utf8'),ctx);vm.runInContext(readFileSync(new URL('../src/application/visitors/record-live-session-events.js',import.meta.url),'utf8'),ctx);vm.runInContext(readFileSync(new URL('../src/application/visitors/build-stored-activity.js',import.meta.url),'utf8'),ctx);vm.runInContext(readFileSync(new URL('../src/adapters/visitors/stored-activity-store.js',import.meta.url),'utf8'),ctx);vm.runInContext(readFileSync(new URL('../src/adapters/visitors/live-visit-counts-store.js',import.meta.url),'utf8'),ctx);vm.runInContext(readFileSync(new URL('../src/adapters/visitors/session-id-store.js',import.meta.url),'utf8'),ctx);vm.runInContext(readFileSync(new URL('../src/adapters/visitors/track-visit.js',import.meta.url),'utf8'),ctx);vm.runInContext(readFileSync(new URL('../src/ui/visitor-map-marker.js',import.meta.url),'utf8'),ctx);ctx.DG_VISITOR_MAP_MARKER_UI=ctx.window.DG_VISITOR_MAP_MARKER_UI;vm.runInContext(readFileSync(new URL('../src/ui/visitor-activity-disclosure.js',import.meta.url),'utf8'),ctx);ctx.DG_VISITOR_ACTIVITY_DISCLOSURE_UI=ctx.window.DG_VISITOR_ACTIVITY_DISCLOSURE_UI;vm.runInContext(readFileSync(new URL('../src/ui/visitor-connection-status.js',import.meta.url),'utf8'),ctx);ctx.DG_VISITOR_CONNECTION_STATUS_UI=ctx.window.DG_VISITOR_CONNECTION_STATUS_UI;vm.runInContext(readFileSync(new URL('../src/ui/visitor-roster.js',import.meta.url),'utf8'),ctx);ctx.DG_VISITOR_ROSTER_UI=ctx.window.DG_VISITOR_ROSTER_UI;vm.runInContext(readFileSync(new URL('../src/ui/visitor-activity-feed.js',import.meta.url),'utf8'),ctx);ctx.DG_VISITOR_ACTIVITY_FEED_UI=ctx.window.DG_VISITOR_ACTIVITY_FEED_UI;vm.runInContext(readFileSync(new URL('../src/ui/visitor-database-activity.js',import.meta.url),'utf8'),ctx);ctx.DG_VISITOR_DATABASE_ACTIVITY_UI=ctx.window.DG_VISITOR_DATABASE_ACTIVITY_UI;vm.runInContext(readFileSync(new URL('../src/adapters/visitors/admin-visit-counts-store.js',import.meta.url),'utf8'),ctx);vm.runInContext(readFileSync(new URL('../src/application/visitors/load-admin-visit-statistics.js',import.meta.url),'utf8'),ctx);for(const path of ["src/adapters/auth/session-store.js","src/domain/visitors/resolve-admin-visit-windows.js","src/domain/visitors/presence-retry-delay.js","src/domain/visitors/build-presence-payload.js","src/adapters/visitors/presence-channel.js","src/adapters/visitors/remove-presence-channel.js","src/adapters/visitors/track-presence.js","src/application/visitors/upgrade-presence-auth.js","src/application/visitors/stop-presence-session.js","src/application/visitors/fail-presence-session.js","src/application/visitors/start-presence-session.js","src/application/visitors/resume-presence-session.js","src/application/visitors/record-presence-action.js","src/application/visitors/record-presence-view.js"])vm.runInContext(readFileSync(new URL('../'+path,import.meta.url),'utf8'),ctx);for(const dir of ['src/domain/visitors','src/application/visitors','src/adapters/visitors','src/ui'])for(const name of readdirSync(new URL('../'+dir,import.meta.url)))if(name.endsWith('.js')&&(dir!=='src/ui'||name.startsWith('visitor-')||name.startsWith('add-visitor-')||name.startsWith('update-live-')))vm.runInContext(readFileSync(new URL('../'+dir+'/'+name,import.meta.url),'utf8'),ctx);vm.runInContext(readFileSync(new URL('../src/services/visit-stats.js',import.meta.url),'utf8'),ctx);return{ctx,els,run:s=>vm.runInContext(s,ctx)};}
test('presence deduplicates users and removes expired sessions',()=>{const a=app(),now=Date.now();a.ctx.state={u:[{id:'a',n:'Old',t:now-20000},{id:'a',n:'Latest',t:now-1000}],v:[{id:'b',t:now-121000},{id:'c',t:now-1000}]};a.run('dgPresenceList=()=>state');const rows=a.run('dgVisRows()');assert.equal(rows.length,2);assert.equal(rows[0].p.n,'Latest');});
test('visitor filters search, active screen and valid location together',()=>{const a=app();a.els.set('visSearch',{value:'sinan'});a.els.set('visViewFilter',{value:'nav'});a.els.set('visLocated',{checked:true});a.ctx.rows=[{p:{n:'Sinan',v:'nav',la:39,lo:32}},{p:{n:'Sinan',v:'map',la:39,lo:32}},{p:{n:'Sinan',v:'nav',la:null,lo:null}}];assert.equal(a.run('dgVisFilter(rows)').length,1);assert.equal(a.run('dgVisHasLocation({la:"bad",lo:32})'),false);});
test('non-owner refresh does not read data or create a live map',async()=>{const a=app();let reads=0;a.ctx.sb={from(){reads++;throw Error('unexpected')}};a.ctx.PROFILE.role='user';await a.run('dgVisRefresh()');assert.equal(reads,0);assert.equal(a.run('DG_VIS_MAP'),null);});
test('owner live visit counts load through the store and update the existing counters',async()=>{const a=app(),queries=[];for(const id of ['vzTotal','vzToday','vz7'])a.els.set(id,{textContent:'old'});a.ctx.sb={from(table){const index=queries.length;let since=null;queries.push({table,get since(){return since}});const q={select(){return q},gte(_column,value){since=value;return q},then(resolve,reject){return Promise.resolve({count:[500,12,88][index]}).then(resolve,reject)}};return q;}};await a.run('dgVisCounts()');assert.equal(queries.length,3);assert.deepEqual(['vzTotal','vzToday','vz7'].map(id=>a.els.get(id).textContent),[500,12,88]);});
test('trackVisit uses the RLS-safe adapter once per session and preserves the request',async()=>{const a=app(),requests=[];a.ctx.sessionStorage={getItem(key){return key==='dg_visited'?this.visited:null},setItem(key,value){if(key==='dg_visited')this.visited=value;}};a.ctx.SB_URL='https://qa.supabase.co';a.ctx.SB_KEY='anon-key';a.ctx.fetch=(url,options)=>{requests.push({url,options});return Promise.resolve({status:201});};await a.run('trackVisit()');await a.run('trackVisit()');assert.equal(requests.length,1);assert.equal(requests[0].url,'https://qa.supabase.co/rest/v1/site_visits');assert.equal(requests[0].options.method,'POST');assert.equal(requests[0].options.headers.apikey,'anon-key');assert.equal(requests[0].options.headers.Authorization,'Bearer anon-key');assert.equal(requests[0].options.headers['Content-Type'],'application/json');assert.equal(requests[0].options.headers.Prefer,'return=minimal');assert.deepEqual(JSON.parse(requests[0].options.body),[{}]);});
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


test('live roster service keeps access and visibility gates and forwards filtered rows to UI/feed/map',()=>{
 const a=app(),box={},calls=[];a.els.set('visLive',box);
 a.ctx.rows=[{p:{n:'Ada',v:'nav',la:39,lo:32},age:3},{p:{n:'Bob',v:'map'},age:4}];
 a.els.set('visViewFilter',{value:'nav'});
 a.ctx.DG_VISITOR_ROSTER_UI={render:(target,rows,options)=>calls.push({kind:'ui',target,rows,options})};
 a.ctx.capture=(kind,rows)=>calls.push({kind,rows});
 a.run('dgVisRows=()=>rows;dgVisFeed=rows=>capture("feed",rows);dgVisMapDraw=rows=>capture("map",rows)');
 for(const gate of ['PROFILE.role="user"','PROFILE.role="owner";document.hidden=true','document.hidden=false;DG_VIS_PAUSED=true','DG_VIS_PAUSED=false;DG_CUR_VIEW="dash"']){a.run(gate+';renderVisitorsLive()');assert.equal(calls.length,0);}
 a.run('DG_CUR_VIEW="visitors";renderVisitorsLive()');
 assert.deepEqual(calls.map(c=>c.kind),['ui','feed','map']);
 assert.equal(calls[0].target,box);assert.equal(calls[0].rows.length,1);assert.equal(calls[0].rows[0].p.n,'Ada');
 assert.equal(calls[0].options.allCount,2);assert.equal(calls[0].options.state,'idle');
 assert.equal(calls[1].rows,calls[0].rows);assert.equal(calls[2].rows,calls[0].rows);
});


test('visitor map renderer keeps location gate, presentation, trails and follow behavior',()=>{
 const a=app(),events=[],layer={clearLayers(){events.push('clear');}};
 const map={invalidateSize(){events.push('invalidate');},setView(coords,zoom){events.push({kind:'view',coords,zoom});}};
 a.ctx.map=map;a.ctx.layer=layer;
 a.run('DG_VIS_MAP=map;DG_VIS_LAYER=layer;dgVisMapInit=()=>{}');
 a.els.set('visTrails',{checked:true});a.els.set('visFollow',{checked:false});
 const add=kind=>(coords,options)=>({addTo(target){assert.equal(target,layer);events.push({kind,coords,options});return this;},bindTooltip(html,options){events.push({kind:'tooltip',html,options});return this;}});
 a.ctx.L={divIcon(options){events.push({kind:'icon',options});return options;},marker:add('marker'),polyline:add('trail'),circleMarker:add('start')};
 a.ctx.dgMateColor=()=> '#123456';
 a.ctx.rows=[{p:{id:'a',n:'Ada',v:'nav',la:39,lo:32,lh:[[39,32],[40,33],['bad',32]]},age:15},{p:{n:'No GPS',la:'bad',lo:32},age:0}];
 a.run('dgVisMapDraw(rows)');
 assert.equal(events.filter(e=>e.kind==='marker').length,1);
 assert.equal(events.filter(e=>e.kind==='trail').length,1);
 assert.deepEqual(JSON.parse(JSON.stringify(events.find(e=>e.kind==='trail').coords)),[[39,32],[40,33]]);
 const marker=events.find(e=>e.kind==='marker');
 assert.deepEqual(Array.from(marker.coords),[39,32]);assert.equal(marker.options.keyboard,false);assert.equal(marker.options.zIndexOffset,700);
 assert.match(events.find(e=>e.kind==='icon').options.html,/background:#123456/);
 assert.match(events.find(e=>e.kind==='tooltip').html,/<b>Ada<\/b><br>Waypoint/);
 assert.equal(events.filter(e=>e.kind==='view').length,1);assert.equal(a.run('DG_VIS_FIT'),true);
 a.run('dgVisMapDraw(rows)');assert.equal(events.filter(e=>e.kind==='view').length,1);
 a.els.get('visFollow').checked=true;a.run('dgVisMapDraw(rows)');assert.equal(events.filter(e=>e.kind==='view').length,2);
});


test('activity disclosure toggle and restore preserve persisted preference and storage-error behavior',()=>{
 const a=app(),wrapper={style:{display:''}},attrs={},button={setAttribute(key,value){attrs[key]=value;}};
 a.els.set('visActivityWrap',wrapper);a.els.set('visActToggle',button);
 const store={};a.ctx.localStorage={getItem:key=>store[key],setItem(key,value){store[key]=value;}};
 a.run('dgVisActToggle()');assert.equal(wrapper.style.display,'none');assert.equal(store.dg_vis_act_open,'0');assert.equal(attrs['aria-expanded'],'false');
 a.run('dgVisActRestore()');assert.equal(wrapper.style.display,'none');
 a.run('dgVisActToggle()');assert.equal(wrapper.style.display,'');assert.equal(store.dg_vis_act_open,'1');assert.equal(attrs['aria-expanded'],'true');
 wrapper.style.display='none';a.run('dgVisActRestore()');assert.equal(wrapper.style.display,'');
 a.ctx.localStorage={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
 a.run('dgVisActToggle()');assert.equal(wrapper.style.display,'none');
 a.run('dgVisActRestore()');assert.equal(wrapper.style.display,'');
 a.els.delete('visActivityWrap');a.run('dgVisActToggle();dgVisActRestore()');
});


test('visitor status service forwards filtered counts and pause/resume retains gates',()=>{
 const a=app(),calls=[],element={};a.els.set('visStatus',element);
 a.ctx.rows=[{p:{n:'Ada',v:'nav'},age:0},{p:{n:'Bob',v:'map'},age:0}];a.els.set('visViewFilter',{value:'nav'});
 a.ctx.DG_VISITOR_CONNECTION_STATUS_UI={render:(...args)=>calls.push(['render',...args]),paused:el=>calls.push(['paused',el])};
 a.run('dgVisRows=()=>rows;dgVisMapDraw=()=>{};DG_PRES_STATE="on";renderVisitorsLive()');
 assert.deepEqual(calls[0],['render',element,'on',1,2]);
 a.run('dgVisPause(true);renderVisitorsLive()');assert.deepEqual(calls[1],['paused',element]);assert.equal(calls.length,2);
 a.run('dgVisPause(false)');assert.deepEqual(calls[2],['render',element,'on',1,2]);
 a.ctx.PROFILE.role='user';a.run('renderVisitorsLive()');assert.equal(calls.length,3);
});
