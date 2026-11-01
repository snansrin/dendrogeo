import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

function setup(){
 const drawn=[],navMap={name:'waypoints'},liveMap={name:'live-map'},elements={nProject:{value:'7'},mProject:{value:'9'},dgMatesNote:{textContent:''}};
 const layer={clearLayers(){drawn.push('clear');}};
 const window={
  DG_PARK_PRESENCE_CHANNEL_ADAPTER:{presence:()=>({})},
  DG_PREPARE_PARK_LIVE_COLLABORATOR_LAYER:{prepare:ports=>{drawn.push(['prepare',ports.map]);ports.setLayer(layer);return layer;}},
  DG_SELECT_PARK_LIVE_COLLABORATORS:{select:()=>[{id:'friend'}]},
  DG_BUILD_PARK_LIVE_COLLABORATOR_VIEW:{build:()=>({})},
  DG_RENDER_PARK_LIVE_COLLABORATOR_MARKER:{render:ports=>drawn.push(['marker',ports.layer])},
  DG_RENDER_PARK_LIVE_COLLABORATOR_COUNT:{render:ports=>drawn.push(['count',ports.count])},
  DG_LEAVE_PARK_PRESENCE_CHANNEL:{leave:ports=>{drawn.push(['leave',ports.map]);ports.setChannel(null);ports.setLayer(null);ports.setParkId(0);}},
  DG_PARK_LIVE_MEMBER_COLOR:{color:()=> '#123456'}
 };
 const ctx=vm.createContext({window,$:id=>elements[id],DG_CUR_VIEW:'nav',navMap,map:liveMap,L:{},USER:{id:'self'},_tmff:value=>value,_tmf:value=>value,dgCf:value=>value,esc:value=>value});
 vm.runInContext(read('src/services/map.js'),ctx,{filename:'src/services/map.js'});
 return{ctx,drawn,navMap,liveMap,elements,run:source=>vm.runInContext(source,ctx)};
}

test('park colleagues are drawn only on the Waypoint map and the selected project',()=>{
 const {run,drawn,navMap,liveMap,elements}=setup();
 run('DG_PARK_CH={};DG_PARK_CH_ID=14;DG_PARK_CH_PROJECT_ID=7;dgLiveMatesDraw()');
 assert.ok(drawn.some(item=>item[0]==='prepare'&&item[1]===navMap));
 assert.ok(drawn.some(item=>item[0]==='marker'));
 assert.ok(!drawn.some(item=>Array.isArray(item)&&item[1]===liveMap));
 elements.nProject.value='8';
 drawn.length=0;
 run('dgLiveMatesDraw()');
 assert.deepEqual(drawn,['clear',['count',0]],'changing projects clears the previous team immediately');
 run('dgLiveShareLeave()');
 assert.ok(drawn.some(item=>item[0]==='leave'&&item[1]===navMap));
});

test('rapidly reopening the same project reuses its in-flight join while a changed project invalidates stale callbacks',async()=>{
 const {ctx,run,elements}=setup(),requests=[],resolve=[];
 ctx.window.DG_JOIN_LIVE_SHARE_PARK={join:ports=>{requests.push(ports);return new Promise(done=>resolve.push(done));}};
 const first=run('dgLiveShareJoinCurrent()');
 const repeat=run('dgLiveShareJoinCurrent()');
 assert.equal(requests.length,1,'same project has exactly one pending join');
 assert.equal(requests[0].isCurrent(),true);
 elements.nProject.value='8';
 const next=run('dgLiveShareJoinCurrent()');
 assert.equal(requests.length,2);
 assert.equal(requests[0].isCurrent(),false,'old callback cannot change the new map');
 assert.equal(requests[1].isCurrent(),true);
 resolve[0]({status:'stale'});resolve[1]({status:'joined',parkId:22});
 await Promise.all([first,repeat,next]);
});

test('a real private Presence join receives its watchdog timer port and publishes the GPS fix',async()=>{
 const {ctx,run}=setup(),events=[],failures=[];
 ctx.setTimeout=setTimeout;ctx.clearTimeout=clearTimeout;
 ctx.GPS={latitude:39.0,longitude:32.0};ctx.PROFILE={full_name:'Test teammate'};
 for(const path of [
  'src/domain/parks/resolve-live-share-join.js',
  'src/application/parks/join-live-share-park.js',
  'src/application/parks/handle-live-share-channel-status.js',
  'src/application/parks/track-park-live-position.js',
  'src/adapters/parks/park-presence-channel.js'
 ])vm.runInContext(read(path),ctx,{filename:path});
 ctx.window.DG_FETCH_LIVE_SHARE_PROJECT_PARK={fetch:async()=>14};
 ctx.window.DG_PARK_LIVE_SHARE_CONNECTION_UI={connecting:()=>events.push('connecting')};
 ctx.window.DG_FAIL_PARK_LIVE_SHARE={fail:()=>failures.push('failed')};
 const channel={
  on(type,{event},callback){assert.equal(type,'presence');assert.equal(event,'sync');this.onSync=callback;return this;},
  subscribe(callback){events.push('subscribed');callback('SUBSCRIBED');return this;},
  track(payload){events.push(['track',payload.la,payload.lo]);return Promise.resolve('ok');},
  presenceState(){return{};}
 };
 ctx.sb={
  auth:{getSession:async()=>({data:{session:{access_token:'test-token'}}})},
  realtime:{setAuth:async token=>{assert.equal(token,'test-token');events.push('authenticated');}},
  channel:(topic,options)=>{assert.equal(topic,'dg-park-14');assert.equal(options.config.private,true);events.push('channel');return channel;},
  removeChannel:()=>{}
 };
 await run('dgLiveShareJoinCurrent()');
 assert.deepEqual(failures,[],'the join must not fail before channel.subscribe');
 assert.deepEqual(events.slice(0,4),['connecting','authenticated','channel','subscribed']);
 assert.ok(events.some(event=>Array.isArray(event)&&event[0]==='track'&&event[1]===39&&event[2]===32));
 assert.equal(run('DG_PARK_CH_LIVE'),true);
});

test('the Waypoint project remains the team channel across measurement tab changes',()=>{
 const {run,elements}=setup();
 assert.equal(run('dgLiveShareProjectId()'),7);
 assert.equal(run('DG_CUR_VIEW="measure";dgLiveShareProjectId()'),7,'a different measurement selection cannot hijack navMap');
 elements.nProject.value='';
 assert.equal(run('dgLiveShareProjectId()'),9,'an empty Waypoint selection can use the measurement project');
});

test('foreground recovery resets exhausted retries and reuses the selected Waypoint project',async()=>{
 const {run,ctx}=setup(),requests=[];
 ctx.window.DG_JOIN_LIVE_SHARE_PARK={join:async ports=>{requests.push(ports.projectId);return {status:'joined'};}};
 run('DG_PARK_CH_RETRY=2;DG_PARK_CH_LIVE=false;dgLiveShareResume()');
 await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(requests,[7]);
 assert.equal(run('DG_PARK_CH_RETRY'),0);
 run('DG_CUR_VIEW="map";dgLiveShareResume()');
 assert.deepEqual(requests,[7],'the Live Map never opens a teammate channel');
});

test('sharing controls and collaborator note belong to the Waypoint map, not the Live Map',()=>{
 const shell=read('partials/shell.html'),nav=shell.split('id="v-nav"')[1].split('id="v-map"')[0],measure=shell.split('id="v-measure"')[1].split('id="v-nav"')[0];
 assert.match(nav,/id="navMap"/);
 assert.match(nav,/id="dgLiveShare" checked data-dg-measure-action="live-share"/);
 assert.match(nav,/id="dgMatesNote"/);
 assert.match(nav,/👥 Ortaklar/);
 assert.doesNotMatch(measure,/id="dgLiveShare"|id="dgMatesNote"/);
 assert.equal((shell.match(/id="dgLiveShare"/g)||[]).length,1);
});

test('waypoint project changes update teammate markers and rejoin the correct park',()=>{
 const shell=read('src/ui/shell.js');
 assert.match(shell,/event\.target\?\.id==="nProject"\)[\s\S]*?dgLiveMatesDraw\(\);[\s\S]*?dgLiveShareJoinCurrent\(\)/);
 assert.match(shell,/\(v==="measure"\|\|v==="nav"\)/);
 assert.match(shell,/addEventListener\("visibilitychange",\(\)=>\{if\(!document\.hidden\)dgLiveShareResume\(\)/);
 assert.match(shell,/onAuthStateChange\(event=>\{/);
 assert.match(shell,/addEventListener\("online",\(\)=>\{if\(!document\.hidden\)dgLiveShareResume\(\)/);
});
