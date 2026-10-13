import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
function load(path,window={}){vm.runInNewContext(source(path),{window});return window;}

test('visitor presentation labels preserve the shared Turkish view and action names',()=>{
 const view=load('src/ui/visitor-view-labels.js').DG_VISITOR_VIEW_LABELS;
 const action=load('src/ui/visitor-action-labels.js').DG_VISITOR_ACTION_LABELS;
 assert.equal(view.map,'Canlı Harita');
 assert.equal(view.visitors,'Ziyaretçi & Canlı');
 assert.equal(action.save,'ölçüm kaydetti');
 assert.equal(action.publish,'rapor yayını istedi');
 assert.equal(Object.isFrozen(view),true);
 assert.equal(Object.isFrozen(action),true);
});

test('presence ping window keeps the ten-second throttle and force bypass',()=>{
 const api=load('src/domain/visitors/presence-ping-window.js').DG_VISITOR_PRESENCE_PING_WINDOW;
 assert.equal(api.shouldSend({now:10999,lastSent:1000}),false);
 assert.equal(api.shouldSend({now:11000,lastSent:1000}),true);
 assert.equal(api.shouldSend({now:1001,lastSent:1000,force:true}),true);
 assert.equal(api.shouldSend({now:5000,lastSent:1000,minimumInterval:4000}),true);
});

test('presence view emits only when the view changes and isolates callback errors',()=>{
 const api=load('src/application/visitors/record-presence-view.js').DG_RECORD_VISITOR_PRESENCE_VIEW;
 const events=[],state={recordView(view){events.push(['record',view]);return view!=='same';}};
 const ping=(view,force)=>events.push(['ping',view,force]);
 assert.equal(api.record('same',state,ping),false);
 assert.equal(api.record('map',state,ping),true);
 assert.equal(api.record('map',null,ping),false);
 assert.deepEqual(events,[['record','same'],['record','map'],['ping','map',true]]);
});

test('presence action records detail and forces an immediate transient update',()=>{
 const api=load('src/application/visitors/record-presence-action.js').DG_RECORD_VISITOR_PRESENCE_ACTION;
 const events=[];
 const state={recordAction:(kind,detail)=>events.push(['record',kind,detail])};
 const ping=(view,force)=>events.push(['ping',view,force]);
 assert.equal(api.record('save','tree 1',state,ping),true);
 assert.deepEqual(events,[['record','save','tree 1'],['ping',null,true]]);
});

test('the five visitor modules load before their service and are included in the offline precache',()=>{
 const head=source('partials/head.html'),worker=source('sw.js');
 const modules=[
  'src/domain/visitors/presence-ping-window.js',
  'src/application/visitors/record-presence-view.js',
  'src/application/visitors/record-presence-action.js',
  'src/ui/visitor-view-labels.js',
  'src/ui/visitor-action-labels.js'
 ];
 const service=head.indexOf('src/services/visit-stats.js');
 for(const path of modules){
  assert.ok(head.indexOf(path)>=0,`${path} is loaded`);
  assert.ok(head.indexOf(path)<service,`${path} loads before the visitor service`);
  assert.ok(worker.includes(`'/${path}'`),`${path} is precached`);
 }
});
