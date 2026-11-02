import {test} from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
test('navigation and live map share one in-flight waypoint read; later refreshes still read current data',async()=>{
 const root={};vm.runInNewContext(readFileSync(new URL('../src/adapters/map/fetch-project-waypoints.js',import.meta.url),'utf8'),{window:root});
 let calls=0,release;const response={data:[],error:null},client={from:()=>{calls++;return{select:()=>({eq:()=>({order:()=>new Promise(resolve=>{release=resolve;})})})};}};
 const first=root.DG_FETCH_PROJECT_WAYPOINTS.fetch({client,projectId:33}),second=root.DG_FETCH_PROJECT_WAYPOINTS.fetch({client,projectId:33});assert.equal(first,second);assert.equal(calls,1);
 release(response);await first;const next=root.DG_FETCH_PROJECT_WAYPOINTS.fetch({client,projectId:33});assert.equal(calls,2);assert.notEqual(next,first);release(response);await next;
});
