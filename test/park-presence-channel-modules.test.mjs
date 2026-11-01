import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const modules=[
  'src/ui/fail-park-live-share.js',
  'src/domain/parks/park-live-member-color.js',
  'src/adapters/parks/park-presence-channel.js',
  'src/adapters/parks/leave-park-presence-channel.js',
  'src/application/parks/track-park-live-position.js'
];
function setup(){const window={};const context=vm.createContext({window,String,Math});for(const path of modules)vm.runInContext(read(path),context,{filename:path});return window;}

test('park Presence failures show the realtime state and retry at most twice',()=>{
  const fail=setup().DG_FAIL_PARK_LIVE_SHARE.fail,events=[],state={live:true,retries:0},note={textContent:''};
  const ports={setLive:value=>{state.live=value;},retries:()=>state.retries,setRetries:value=>{state.retries=value;},note,translate:value=>value,setTimer:(fn,ms)=>events.push(['timer',fn,ms]),removeChannel:()=>events.push('remove'),resetChannel:()=>events.push('reset'),isEnabled:()=>true,join:()=>events.push('join')};
  fail(ports);assert.equal(state.live,false);assert.equal(state.retries,1);assert.match(note.textContent,/Supabase/);assert.equal(events[0][2],3000);events[0][1]();assert.deepEqual(events.slice(1),['remove','reset','join']);
  state.retries=2;events.length=0;fail(ports);assert.equal(events.length,0);
});

test('collaborator colors are stable and selected from the supplied palette',()=>{
  const color=setup().DG_PARK_LIVE_MEMBER_COLOR.color,palette=['red','blue','green'];
  assert.equal(color('user-a',palette),color('user-a',palette));assert.ok(palette.includes(color('user-b',palette)));assert.equal(color('',palette),color('?',palette));
});

test('private park Presence authenticates before joining and installs its watchdog',async()=>{
  const join=setup().DG_PARK_PRESENCE_CHANNEL_ADAPTER.join,events=[],channel={on(...args){events.push(['on',...args]);return this;},subscribe(callback){events.push('subscribe');callback('SUBSCRIBED');return this;}},client={channel:(topic,options)=>{events.push(['channel',topic,options]);return channel;},auth:{getSession:async()=>{events.push('session');return{data:{session:{access_token:'jwt'}}};}},realtime:{setAuth:async token=>events.push(['auth',token])}};
  let currentChannel=null,watch=null;
  const result=await join({client,parkId:9,userId:3,onSync:()=>{},onStatus:()=>{},setChannel:value=>{currentChannel=value;events.push('set-channel');},getWatch:()=>watch,setWatch:value=>{watch=value;},clearTimer:value=>events.push(['clear',value]),setTimer:(fn,ms)=>{events.push(['timer',ms]);return 77;},onWatchdog:()=>{}});
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(result,channel);assert.equal(currentChannel,channel);assert.equal(watch,77);assert.deepEqual(events.filter(e=>Array.isArray(e)).map(e=>e[0]).slice(0,4),['auth','channel','on','timer']);assert.ok(events.indexOf('auth')<events.indexOf('subscribe'));assert.deepEqual(JSON.parse(JSON.stringify(events.find(e=>Array.isArray(e)&&e[0]==='channel')[2])),{config:{private:true,presence:{key:'3'}}});assert.ok(events.some(e=>Array.isArray(e)&&e[0]==='timer'&&e[1]===8000));
});

test('a stale waypoint selection never creates a private Presence channel after auth',async()=>{
  const join=setup().DG_PARK_PRESENCE_CHANNEL_ADAPTER.join,events=[];
  const client={auth:{getSession:async()=>({data:{session:{access_token:'jwt'}}})},realtime:{setAuth:async()=>{events.push('auth');}},channel:()=>{events.push('channel');throw new Error('obsolete project channel');}};
  const result=await join({client,parkId:9,userId:3,isCurrent:()=>false});
  assert.equal(result,null);
  assert.deepEqual(events,['auth']);
});

test('Realtime client details stay inside the channel adapter',()=>{
  const adapter=read('src/adapters/parks/park-presence-channel.js'),map=read('src/services/map.js');
  assert.match(adapter,/presence\(\{channel\}\)/);
  assert.match(adapter,/await client\.realtime\.setAuth\(token\)/);
  assert.doesNotMatch(map,/\.presenceState\s*\(|\.realtime\s*\./);
  assert.doesNotMatch(map,/function dgLiveMatesDraw\(\)[\s\S]*?L\.marker/);
});

test('leaving removes the ephemeral channel and its map layer, then clears the note',()=>{
  const leave=setup().DG_LEAVE_PARK_PRESENCE_CHANNEL.leave,events=[],state={channel:{},parkId:9,layer:{}};
  leave({channel:state.channel,client:{removeChannel:value=>events.push(['remove',value])},layer:state.layer,map:{removeLayer:value=>events.push(['layer',value])},setChannel:value=>{state.channel=value;},setParkId:value=>{state.parkId=value;},setLayer:value=>{state.layer=value;},note:{set textContent(value){events.push(['note',value]);}}});
  assert.deepEqual(state,{channel:null,parkId:0,layer:null});assert.deepEqual(events.map(event=>event[0]),['remove','layer','note']);
});

test('position tracking keeps the ten-second throttle and exact ephemeral payload',()=>{
  const ping=setup().DG_TRACK_PARK_LIVE_POSITION.ping,events=[],channel={track:payload=>events.push(payload)},state={last:0};
  const ports={channel,live:true,enabled:true,gps:{latitude:39.1,longitude:32.7},userId:5,name:'Ada',lastPing:state.last,now:20000,setLastPing:value=>{state.last=value;}};
  ping(ports);assert.deepEqual(JSON.parse(JSON.stringify(events[0])),{id:'5',n:'Ada',la:39.1,lo:32.7,t:20000});assert.equal(state.last,20000);ping({...ports,lastPing:state.last,now:25000});assert.equal(events.length,1);
});

test('park presence modules load before the locked map service and are precached',()=>{
  const head=read('partials/head.html'),sw=read('sw.js'),map=read('src/services/map.js');
  for(const path of modules){assert.ok(head.includes(`src="${path}?v=`),`${path} script`);assert.ok(sw.includes(`'/${path}'`),`${path} precache`);assert.ok(head.indexOf(`src="${path}?v=`)<head.indexOf('src="src/services/map.js?'),`${path} precedes locked service`);}
  for(const name of ['DG_FAIL_PARK_LIVE_SHARE','DG_PARK_LIVE_MEMBER_COLOR','DG_PARK_PRESENCE_CHANNEL_ADAPTER','DG_LEAVE_PARK_PRESENCE_CHANNEL','DG_TRACK_PARK_LIVE_POSITION'])assert.ok(map.includes(name));
});
