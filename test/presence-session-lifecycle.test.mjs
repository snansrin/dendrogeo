import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const paths=['src/domain/visitors/presence-retry-delay.js','src/application/visitors/stop-presence-session.js',
 'src/application/visitors/fail-presence-session.js','src/application/visitors/start-presence-session.js',
 'src/application/visitors/resume-presence-session.js'];
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
function load(){const window={};for(const path of paths)vm.runInNewContext(read(path),{window});return window;}
function state(overrides={}){return{channel:{topic:'presence'},ready:true,status:'on',retryCount:0,lastPing:10,watchTimer:{id:1},
 heartbeatTimer:{id:2},retryTimer:null,user:'u1',generation:3,...overrides};}
function timers(){
 const calls=[],api={setTimeout(callback,delay){const handle={callback,delay};calls.push(['timeout',handle]);return handle;},
  clearTimeout(handle){calls.push(['clear-timeout',handle]);},setInterval(callback,delay){const handle={callback,delay};calls.push(['interval',handle]);return handle;},
  clearInterval(handle){calls.push(['clear-interval',handle]);}};
 return{api,calls};
}

test('presence retry schedule keeps its capped exponential delays',()=>{
 const api=load().DG_VISITOR_PRESENCE_RETRY_DELAY;
 assert.deepEqual([0,1,2,3,4,5,20].map(api.resolve),[1500,3000,6000,12000,24000,24000,24000]);
});

test('stopping a presence session invalidates callbacks and removes its channel',()=>{
 const api=load().DG_STOP_VISITOR_PRESENCE_SESSION,stateBefore=state(),clock=timers(),removed=[];
 api.stop(stateBefore,clock.api,channel=>removed.push(channel));
 assert.equal(stateBefore.generation,4);assert.equal(stateBefore.channel,null);assert.equal(stateBefore.user,null);
 assert.equal(stateBefore.ready,false);assert.equal(stateBefore.status,'idle');
 assert.deepEqual(removed,[{topic:'presence'}]);
 assert.deepEqual(clock.calls.map(call=>call[0]),['clear-timeout','clear-timeout','clear-interval']);
});

test('presence failure exposes the error and schedules stop/start with backoff',()=>{
 const api=load().DG_FAIL_VISITOR_PRESENCE_SESSION,stateBefore=state(),clock=timers(),events=[];
 assert.equal(api.fail(stateBefore,'CHANNEL_ERROR',{timers:clock.api,emit:why=>events.push(['emit',why]),
  retryDelay:attempt=>load().DG_VISITOR_PRESENCE_RETRY_DELAY.resolve(attempt),stop:()=>events.push('stop'),start:()=>events.push('start')}),true);
 assert.equal(stateBefore.status,'error');assert.equal(stateBefore.ready,false);assert.equal(stateBefore.retryCount,1);
 assert.deepEqual(events,[['emit','CHANNEL_ERROR']]);
 const retry=clock.calls.find(call=>call[0]==='timeout')[1];assert.equal(retry.delay,1500);
 assert.equal(api.fail(stateBefore,'again',{timers:clock.api,emit(){},retryDelay:()=>1,stop(){},start(){}}),false);
 retry.callback();assert.deepEqual(events,[['emit','CHANNEL_ERROR'],'stop','start']);
 assert.equal(stateBefore.retryTimer,null);
});

test('starting a session subscribes before auth and guards stale callbacks',()=>{
 const api=load().DG_START_VISITOR_PRESENCE_SESSION,clock=timers(),events=[],stateBefore=state({channel:null,ready:false,status:'idle',watchTimer:null,heartbeatTimer:null,user:null});
 let onStatus;
 const channel={};
 const result=api.start({state:stateBefore,user:{id:'u1'},sessionId:'sid',
  channelAdapter:{open(userId,sid,onSync){events.push(['open',userId,sid]);return channel;},subscribe(value,callback){events.push('subscribe');onStatus=callback;}},
  authPorts:{},authUpgrade:{run(ports,generation,isCurrent){events.push(['auth',generation,isCurrent(generation)]);}},
  timers:clock.api,emit:()=>events.push('emit'),ping:(...args)=>events.push(['ping',...args]),stop:()=>{},fail:reason=>events.push(['fail',reason]),getView:()=>'map'});
 assert.equal(result,true);assert.deepEqual(events.slice(0,3),['emit',['open','u1','sid'],'subscribe']);
 assert.ok(events.findIndex(event=>Array.isArray(event)&&event[0]==='auth')>events.indexOf('subscribe'));
 assert.equal(stateBefore.status,'connecting');assert.ok(stateBefore.watchTimer);
 onStatus('SUBSCRIBED');
 assert.equal(stateBefore.status,'on');assert.equal(stateBefore.ready,true);assert.equal(stateBefore.retryCount,0);
 assert.ok(events.some(event=>Array.isArray(event)&&event[0]==='ping'&&event[1]==='map'&&event[2]===true));
 const count=events.length;stateBefore.generation++;
 onStatus('CHANNEL_ERROR');assert.equal(events.length,count);
});

test('presence watchdog fails only the same generation still connecting',()=>{
 const api=load().DG_START_VISITOR_PRESENCE_SESSION,clock=timers(),events=[],stateBefore=state({channel:null,ready:false,status:'idle',watchTimer:null,heartbeatTimer:null,user:null});
 api.start({state:stateBefore,user:{id:'u'},sessionId:'sid',
  channelAdapter:{open:()=>({}),subscribe(){}},authPorts:{},authUpgrade:{run(){}},timers:clock.api,emit(){},
  ping(){},stop(){},fail:reason=>events.push(reason),getView:()=> 'dash'});
 const watchdog=clock.calls.find(call=>call[0]==='timeout')[1];assert.equal(watchdog.delay,20000);
 stateBefore.generation++;watchdog.callback();assert.deepEqual(events,[]);
 stateBefore.generation--;watchdog.callback();assert.deepEqual(events,['WATCHDOG']);
});

test('resume restarts missing sessions and pings a ready session',()=>{
 const api=load().DG_RESUME_VISITOR_PRESENCE_SESSION,events=[];
 assert.equal(api.resume({user:null,ready:false,stop:()=>events.push('stop'),start:()=>events.push('start'),ping:()=>events.push('ping')}),false);
 api.resume({user:{id:'u'},ready:false,stop:()=>events.push('stop'),start:()=>events.push('start'),ping:()=>events.push('ping')});
 api.resume({user:{id:'u'},ready:true,stop:()=>events.push('stop'),start:()=>events.push('start'),ping:()=>events.push('ping')});
 assert.deepEqual(events,['stop','start','ping']);
});

test('presence service composes lifecycle modules while retaining legacy entry points',()=>{
 const source=read('src/services/visit-stats.js');
 for(const name of ['DG_VISITOR_PRESENCE_RETRY_DELAY','DG_STOP_VISITOR_PRESENCE_SESSION','DG_FAIL_VISITOR_PRESENCE_SESSION','DG_START_VISITOR_PRESENCE_SESSION','DG_RESUME_VISITOR_PRESENCE_SESSION'])assert.ok(source.includes(name));
 for(const name of ['dgPresenceStop','dgPresenceFail','dgPresenceStart','dgPresenceResume'])assert.ok(source.includes('function '+name));
});
