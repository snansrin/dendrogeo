import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const files={
 activity:'src/application/visitors/load-owner-activity.js',
 counts:'src/application/visitors/load-owner-counts.js',
 refresh:'src/application/visitors/refresh-owner-view.js',
 timer:'src/application/visitors/live-refresh-timer.js',
 focus:'src/ui/focus-live-location.js'
};
function load(file){
 const window={};
 vm.runInNewContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),{window,Promise,setInterval,clearInterval});
 return window;
}

test('owner activity loader keeps owner and missing-container guards and existing render ports',async()=>{
 const api=load(files.activity).DG_LOAD_OWNER_VISITOR_ACTIVITY,events=[];
 const ports={container:()=>({id:'box'}),load:async()=>['data'],build:(data,options)=>{events.push(['build',data,options.translate('row'),options.translateValue('raw')]);return['row'];},locale:()=> 'tr-TR',translate:value=>'tr:'+value,translateValue:value=>'value:'+value,escape:value=>'esc:'+value,render:(...args)=>events.push(['render',...args])};
 assert.equal(await api.execute({role:'member'},ports),undefined);
 assert.equal(await api.execute({role:'owner'},{...ports,container:()=>null}),undefined);
 await api.execute({role:'owner'},ports);
 assert.equal(events[0][0],'build');assert.deepEqual(Array.from(events[0].slice(1)),[['data'],'tr:row','value:raw']);
 assert.equal(events[1][0],'render');assert.equal(events[1][1].id,'box');assert.deepEqual(Array.from(events[1][2]),['row']);assert.equal(events[1][3].locale,'tr-TR');
});

test('owner count loader updates three existing counters and absorbs store errors',async()=>{
 const api=load(files.counts).DG_LOAD_OWNER_VISITOR_COUNTS,updates=[];
 await api.execute(()=>false,{load:async()=>assert.fail('owner guard'),update(){}});
 await api.execute(()=>true,{load:async()=>({total:7,today:2,sevenDays:5}),update:(...args)=>updates.push(args)});
 assert.deepEqual(updates,[['vzTotal',7],['vzToday',2],['vz7',5]]);
 await assert.doesNotReject(api.execute(()=>true,{load:async()=>{throw Error('store unavailable');},update(){}}));
});

test('owner view refresh preserves guard, resume, parallel loads and finally cleanup',async()=>{
 const api=load(files.refresh).DG_REFRESH_OWNER_VISITOR_VIEW,events=[];
 const ports={isRefreshing:()=>false,resume:()=>events.push('resume'),setRefreshing:value=>events.push(['lock',value]),render:()=>events.push('render'),counts:async()=>events.push('counts'),activity:async()=>events.push('activity')};
 await api.execute(()=>false,ports);assert.deepEqual(events,[]);
 await api.execute(()=>true,{...ports,isRefreshing:()=>true});assert.deepEqual(events,[]);
 await api.execute(()=>true,ports);assert.deepEqual(events,['resume',['lock',true],'render','counts','activity',['lock',false]]);
 const failed=[];
 await assert.rejects(api.execute(()=>true,{...ports,resume:()=>{},setRefreshing:value=>failed.push(value),counts:async()=>{throw Error('failed');},activity:async()=>{}}),/failed/);
 assert.deepEqual(failed,[true,false]);
});

test('live refresh timer replaces old interval, checks visitor view and stops cleanly',()=>{
 const api=load(files.timer).DG_VISITOR_LIVE_REFRESH_TIMER,events=[];let timer=3,callback;
 const ports={getTimer:()=>timer,setTimer:value=>{timer=value;events.push(['timer',value]);},setInterval:(fn,delay)=>{callback=fn;events.push(['interval',delay]);return 9;},clearInterval:id=>events.push(['clear',id]),isVisitorsView:()=>false,render:()=>events.push('render')};
 api.start(ports);assert.deepEqual(events.slice(0,3),[['clear',3],['timer',null],['interval',10000]]);assert.equal(timer,9);
 callback();assert.equal(events.includes('render'),false);
 ports.isVisitorsView=()=>true;callback();assert.equal(events.at(-1),'render');
 api.stop(ports);assert.equal(timer,null);assert.deepEqual(events.slice(-2),[['clear',9],['timer',null]]);
});

test('live location focus retains owner, coordinate and map guards',()=>{
 const api=load(files.focus).DG_FOCUS_LIVE_VISITOR_LOCATION,events=[];
 const ports={allowed:()=>true,hasLocation:p=>Number.isFinite(p.la)&&Number.isFinite(p.lo),followControl:()=>({checked:true}),map:()=>({setView:(...args)=>events.push(args)})};
 api.focus(1,2,{...ports,allowed:()=>false});api.focus(NaN,2,ports);api.focus(1,2,{...ports,map:()=>null});assert.deepEqual(events,[]);
 let follow;api.focus(1,2,{...ports,followControl:()=>follow={checked:true}});assert.equal(follow.checked,false);assert.deepEqual(JSON.parse(JSON.stringify(events)),[[[1,2],16]]);
});

test('visitor service delegates all five extracted view workflows',()=>{
 const source=readFileSync(new URL('../src/services/visit-stats.js',import.meta.url),'utf8');
 for(const api of Object.keys(files).map(key=>({activity:'DG_LOAD_OWNER_VISITOR_ACTIVITY',counts:'DG_LOAD_OWNER_VISITOR_COUNTS',refresh:'DG_REFRESH_OWNER_VISITOR_VIEW',timer:'DG_VISITOR_LIVE_REFRESH_TIMER',focus:'DG_FOCUS_LIVE_VISITOR_LOCATION'}[key])))assert.ok(source.includes('window.'+api));
});
