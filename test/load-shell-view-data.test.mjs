import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
function create(events){
 const window={},context=vm.createContext({window,console:{warn(){}}});
 vm.runInContext(read('src/application/dashboard/load-shell-view-data.js'),context);
 const call=name=>async()=>{events.push(name);};
 return window.DG_SHELL_VIEW_DATA.create({loadProjects:call('projects'),loadWaypoints:call('waypoints'),loadDashboard:call('dashboard'),loadRecords:call('records'),loadWorld:call('world'),loadMyRequests:call('my-requests'),loadRequestOptions:call('request-options')});
}

test('shell startup leaves inactive records, world and request views unloaded',async()=>{
 const events=[],loader=create(events);await loader.start();await Promise.resolve();
 assert.deepEqual(events,['dashboard','projects']);
 await loader.load('records');await loader.load('world');await loader.load('export');
 assert.deepEqual(events,['dashboard','projects','records','world','my-requests','request-options']);
});

test('shell view loader shares requests while the same view is already loading',async()=>{
 const events=[],loader=create(events);let release;
 const pending=new Promise(resolve=>{release=resolve;});
 const waiting=loader.load('records');
 const second=loader.load('records');
 /* The regular loader finishes quickly; a separate instance exercises an in-flight request. */
 const window={},context=vm.createContext({window,console:{warn(){}}});
 vm.runInContext(read('src/application/dashboard/load-shell-view-data.js'),context);
 const instance=window.DG_SHELL_VIEW_DATA.create({loadProjects:async()=>{},loadWaypoints:async()=>{},loadDashboard:async()=>{},loadRecords:()=>pending.then(()=>events.push('slow-records')),loadWorld:async()=>{},loadMyRequests:async()=>{},loadRequestOptions:async()=>{}});
 const one=instance.load('records'),two=instance.load('records');release();
 await Promise.all([waiting,second,one,two]);assert.deepEqual(events,['records','slow-records']);
});

test('shell delegates startup and selected-view data to the application module',()=>{
 const shell=read('src/ui/shell.js');
 assert.match(shell,/DG_SHELL_VIEW_DATA\.create/);
 assert.match(shell,/_dgShellViewData\.load\(v\)/);
 assert.match(shell,/if\(window\.DG_SHELL_VIEW_DATA\)[\s\S]*?await startup\.start\(\)/);
});
