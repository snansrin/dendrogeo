import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
function load(path,window={}){vm.runInNewContext(source(path),{window});return window;}

test('presence payload builder keeps bounded transient session and GPS history',()=>{
 const events={locations:[],recordLocation(latitude,longitude,at){this.locations.push([latitude,longitude,at]);},snapshot(){return{views:[{v:'map',t:2}],lastAction:{k:'save',d:'bounded'},locations:this.locations.slice()};}};
 const api=load('src/domain/visitors/build-presence-payload.js').DG_VISITOR_PRESENCE_PAYLOAD;
 const payload=api.build({user:{id:7},profile:{full_name:'Ada',role:'owner'},view:'nav',now:3,gps:{latitude:39,longitude:32},sid:'sid',sessionStart:1,deviceTag:'desktop',events,hidden:true});
 assert.deepEqual(JSON.parse(JSON.stringify(payload)),{id:'7',n:'Ada',r:'owner',v:'nav',t:3,la:39,lo:32,sid:'sid',st:1,dev:'desktop',vh:[{v:'map',t:2}],act:{k:'save',d:'bounded'},hidden:true});
 assert.deepEqual(events.locations,[[39,32,3]]);
});

test('presence channel is prepared and subscribed through separate ordered calls',()=>{
 const api=load('src/adapters/visitors/presence-channel.js').DG_VISITOR_PRESENCE_CHANNEL_ADAPTER.create(),events=[];
 const channel={on(...args){events.push(['on',...args]);return this;},subscribe(callback){events.push(['subscribe',callback]);}};
 const client={channel(topic,options){events.push(['channel',topic,options]);return channel;}};
 const onSync=()=>{},onStatus=()=>{};
 const opened=api.open(client,'user','session',onSync);
 assert.equal(opened,channel);
 assert.deepEqual(events.map(event=>event[0]),['channel','on']);
 api.subscribe(channel,onStatus);
 assert.equal(events[2][0],'subscribe');assert.equal(events[2][1],onStatus);
 assert.equal(JSON.stringify(events[0][2]),JSON.stringify({config:{presence:{key:'user:session'}}}));
});

test('presence auth upgrades only the current connection after subscribe setup',async()=>{
 const api=load('src/application/visitors/upgrade-presence-auth.js').DG_UPGRADE_VISITOR_PRESENCE_AUTH.create();
 const events=[],client={auth:{async getSession(){events.push('session');return{data:{session:{access_token:'jwt'}}};}},realtime:{async setAuth(token){events.push(token);}}};
 await api.run(client,4,generation=>generation===4);
 await api.run(client,5,generation=>generation===4);
 assert.deepEqual(events,['session','jwt','session']);
});

test('presence tracking reports current failures and ignores stale connection results',async()=>{
 const api=load('src/adapters/visitors/track-presence.js').DG_VISITOR_TRACK_PRESENCE.create(),failures=[];
 api.send({track:async()=> 'timed out'},{},2,value=>value===2,reason=>failures.push(reason));
 api.send({track:async()=> 'timed out'},{},1,value=>value===2,reason=>failures.push(reason));
 api.send({track:async()=>{throw Error('offline');}},{},2,value=>value===2,reason=>failures.push(reason));
 await new Promise(resolve=>setTimeout(resolve,0));
 assert.deepEqual(failures,['TRACK','TRACK']);
});

test('presence cleanup isolates a rejected Supabase removal',async()=>{
 const api=load('src/adapters/visitors/remove-presence-channel.js').DG_VISITOR_REMOVE_PRESENCE_CHANNEL.create();
 assert.doesNotThrow(()=>api.remove({removeChannel:async()=>{throw Error('offline');}},{topic:'presence'}));
 await new Promise(resolve=>setTimeout(resolve,0));
});

test('visit service composes presence modules without waiting for JWT before subscribe',async()=>{
 const events=[],window={addEventListener(){},DG_VISITOR_TRACK_VISIT_ADAPTER:{create:()=>({record(){}})},
  DG_VISITOR_ADMIN_VISIT_COUNTS_STORE:{create:()=>({})},DG_VISITOR_SESSION_ID_STORE:{load:()=>'sid'},
  DG_VISITOR_DEVICE_LABEL:{build:()=>'desktop'},DG_VISITOR_ACTIVITY_APPLICATION:{create:()=>({})},
  DG_VISITOR_STORED_ACTIVITY_APPLICATION:{create:()=>({})},DG_VISITOR_STORED_ACTIVITY_STORE:{create:()=>({})},
  DG_VISITOR_LIVE_VISIT_COUNTS_STORE:{create:()=>({})},DG_VISITOR_ROSTER_APPLICATION:{create:()=>({})}};
 for(const path of ['src/domain/visitors/build-presence-payload.js','src/application/visitors/record-live-session-events.js',
  'src/adapters/visitors/presence-channel.js','src/adapters/visitors/remove-presence-channel.js',
  'src/adapters/visitors/track-presence.js','src/application/visitors/upgrade-presence-auth.js',
  'src/domain/visitors/presence-retry-delay.js','src/application/visitors/stop-presence-session.js',
  'src/application/visitors/fail-presence-session.js','src/application/visitors/start-presence-session.js',
  'src/application/visitors/resume-presence-session.js']){
  vm.runInNewContext(source(path),{window});
 }
 const context=vm.createContext({window,document:{hidden:false,addEventListener(){}},navigator:{userAgent:'QA'},
  sessionStorage:{getItem:()=> 'sid'},setTimeout,clearTimeout,setInterval,clearInterval,Date,Promise,console,
  USER:{id:'u1'},PROFILE:{role:'owner',full_name:'Ada'},DG_CUR_VIEW:'map',GPS:{latitude:39,longitude:32},
  $:()=>null,esc:String});
 let notify;
 const channel={on(){return this;},subscribe(callback){events.push('subscribe');notify=callback;return this;},
  track:async payload=>{events.push(['track',payload]);return'ok';},presenceState:()=>({})};
 context.sb={channel(topic){events.push(['channel',topic]);return channel;},removeChannel:async()=>{},
  auth:{async getSession(){events.push('auth');return{data:{session:{access_token:'jwt'}}};}},
  realtime:{async setAuth(token){events.push(['auth-token',token]);}}};
 vm.runInContext(source('src/services/visit-stats.js'),context);
 vm.runInContext('dgPresenceStart()',context);
 assert.deepEqual(events.slice(0,2),[['channel','dg-presence'],'subscribe']);
 notify('SUBSCRIBED');
 await new Promise(resolve=>setTimeout(resolve,0));
 const sent=events.find(event=>Array.isArray(event)&&event[0]==='track');
 assert.equal(sent[1].sid,'sid');assert.equal(sent[1].la,39);assert.equal(sent[1].v,'map');
 assert.ok(events.indexOf('auth')>events.indexOf('subscribe'));
 vm.runInContext('dgPresenceStop()',context);
});
