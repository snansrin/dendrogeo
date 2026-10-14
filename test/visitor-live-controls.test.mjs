import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

function load(){
 const window={},context=vm.createContext({window,Array,Object,String,Boolean});
 for(const file of [
  'src/application/visitors/toggle-activity-disclosure.js',
  'src/application/visitors/restore-activity-disclosure.js',
  'src/ui/update-live-visitor-filters.js',
  'src/application/visitors/set-live-visitor-pause.js',
  'src/application/visitors/fit-live-visitor-map.js'
 ])vm.runInContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),context);
 return window;
}

test('activity disclosure toggles before persistence and tolerates storage failures',()=>{
 const modules=load(),events=[];
 assert.equal(modules.DG_TOGGLE_VISITOR_ACTIVITY_DISCLOSURE.toggle(true,{render:value=>events.push(['render',value]),persist:value=>events.push(['save',value])}),false);
 assert.deepEqual(events,[['render',false],['save',false]]);
 assert.equal(modules.DG_TOGGLE_VISITOR_ACTIVITY_DISCLOSURE.toggle(false,{render:value=>events.push(['render',value]),persist(){throw Error('storage denied');}}),true);
 assert.deepEqual(events.at(-1),['render',true]);
});

test('activity disclosure restores its default-open state when storage is absent or blocked',()=>{
 const modules=load(),events=[];
 assert.equal(modules.DG_RESTORE_VISITOR_ACTIVITY_DISCLOSURE.restore({read:()=>"0",render:value=>events.push(value)}),false);
 assert.equal(modules.DG_RESTORE_VISITOR_ACTIVITY_DISCLOSURE.restore({read(){throw Error('storage denied');},render:value=>events.push(value)}),true);
 assert.deepEqual(events,[false,true]);
});

test('reset and quick visitor filters preserve their control and redraw behavior',()=>{
 const modules=load(),events=[],search={value:'Ada'},view={value:'map'},located={checked:true};
 modules.DG_UPDATE_LIVE_VISITOR_FILTERS.reset({text:[search,view,null],located},()=>events.push('reset'));
 assert.equal(search.value,'');assert.equal(view.value,'');assert.equal(located.checked,false);
 modules.DG_UPDATE_LIVE_VISITOR_FILTERS.quick({search,view,located},'measure',true,()=>events.push('quick'));
 assert.deepEqual([search.value,view.value,located.checked],['','measure',true]);assert.deepEqual(events,['reset','quick']);
});

test('visitor pause and fit actions preserve redraw ordering and filtered rows',()=>{
 const modules=load(),events=[],rows=[1,2,3];
 modules.DG_SET_LIVE_VISITOR_PAUSE.set(false,{render:()=>events.push('render'),showPaused:()=>events.push('paused')});
 modules.DG_SET_LIVE_VISITOR_PAUSE.set(true,{render:()=>events.push('render'),showPaused:()=>events.push('paused')});
 const result=modules.DG_FIT_LIVE_VISITOR_MAP.fit(value=>events.push(['fit-state',value]),input=>input.filter(value=>value>1),rows,filtered=>{events.push(['draw',filtered]);return filtered.length;});
 assert.equal(result,2);assert.deepEqual(JSON.parse(JSON.stringify(events)),['render','paused',['fit-state',false],['draw',[2,3]]]);
});

test('visitor service delegates controls and keeps the locked device preference key',()=>{
 const source=readFileSync(new URL('../src/services/visit-stats.js',import.meta.url),'utf8');
 for(const control of ['DG_TOGGLE_VISITOR_ACTIVITY_DISCLOSURE','DG_RESTORE_VISITOR_ACTIVITY_DISCLOSURE','DG_UPDATE_LIVE_VISITOR_FILTERS','DG_SET_LIVE_VISITOR_PAUSE','DG_FIT_LIVE_VISITOR_MAP'])assert.ok(source.includes('window.'+control));
 assert.match(source,/localStorage\.setItem\("dg_vis_act_open"/);
 assert.match(source,/trackVisit\(\)/);
});
