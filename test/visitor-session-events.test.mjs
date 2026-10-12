import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../src/application/visitors/record-live-session-events.js',import.meta.url),'utf8');
function createClock(){
 let now=1000;
 const context={window:{},Date:{now:()=>now}};vm.runInNewContext(source,context);
 return{events:context.window.DG_VISITOR_SESSION_EVENTS_APPLICATION.create(),setNow:value=>{now=value;}};
}
const plain=value=>JSON.parse(JSON.stringify(value));

test('view history skips adjacent duplicates and keeps the newest eight entries',()=>{
 const {events,setNow}=createClock();
 assert.equal(events.recordView('dash'),true);
 setNow(1100);assert.equal(events.recordView('dash'),false);
 for(let i=0;i<9;i++){setNow(2000+i);events.recordView('view-'+i);}
 const snapshot=plain(events.snapshot());
 assert.equal(snapshot.views.length,8);
 assert.deepEqual(snapshot.views.map(x=>x.v),Array.from({length:8},(_,i)=>'view-'+(i+1)));
 assert.deepEqual(snapshot.views.map(x=>x.t),Array.from({length:8},(_,i)=>2001+i));
});

test('last action preserves its type, timestamp and 60-character detail cap',()=>{
 const {events,setNow}=createClock();setNow(4321);
 events.recordAction('save','x'.repeat(72));
 assert.deepEqual(plain(events.snapshot().lastAction),{k:'save',t:4321,d:'x'.repeat(60)});
 setNow(5000);events.recordAction('export','');
 assert.deepEqual(plain(events.snapshot().lastAction),{k:'export',t:5000,d:''});
});

test('location history suppresses movement within the old tolerance and keeps twelve points',()=>{
 const {events}=createClock();
 events.recordLocation(39,32,100);
 events.recordLocation(39.000005,32,200); // within 1e-5 degrees
 events.recordLocation(39.00002,32,300);
 for(let i=0;i<12;i++)events.recordLocation(39.001+i/10000,32,400+i);
 const snapshot=plain(events.snapshot());
 assert.equal(snapshot.locations.length,12);
 assert.deepEqual(snapshot.locations[0],[39.001,32,400]);
 assert.deepEqual(snapshot.locations.at(-1),[39.0021,32,411]);
});

test('snapshots return fresh bounded collection arrays',()=>{
 const {events}=createClock();events.recordView('map');events.recordLocation(39,32,100);
 const first=events.snapshot();first.views.push({v:'injected',t:0});first.locations.push([0,0,0]);
 const next=plain(events.snapshot());
 assert.deepEqual(next.views,[{v:'map',t:1000}]);
 assert.equal(next.locations.length,1);
});
