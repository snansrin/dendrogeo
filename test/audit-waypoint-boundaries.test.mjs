import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
function module(path,key){const window={};vm.runInNewContext(readFileSync(path,'utf8'),{window});return window[key];}
function pointClient({total=1001,failPage=false}={}){
 const pages=[],rows=Array.from({length:total},(_,i)=>({id:i+1,project_id:7,wp_id:i+1,lat:39,lon:32}));
 return {pages,client:{from(table){let start=0,end=999;const q={select(){return q;},eq(column,value){assert.equal(column,'project_id');assert.equal(value,7);return q;},in(){return q;},order(){return q;},range(a,b){start=a;end=b;return q;},then(resolve){if(table==='waypoints'){pages.push(start);return Promise.resolve(start&&failPage?{data:null,error:{message:'page failed'}}:{data:rows.slice(start,end+1),error:null}).then(resolve);}return Promise.resolve({data:[{point_id:1001,girth_cm:90,height_m:8,status:'Onaylı'}],error:null}).then(resolve);}};return q;}}};
}
test('waypoint loading retains points beyond the API page limit and their measured state',async()=>{
 const api=module('src/adapters/map/fetch-project-waypoints.js','DG_FETCH_PROJECT_WAYPOINTS'),x=pointClient();
 const result=await api.fetch({client:x.client,projectId:7});
 assert.equal(result.data.length,1001);assert.deepEqual(x.pages,[0,1000]);assert.equal(result.data.at(-1).visited,true);assert.equal(result.data.at(-1).hasMeasurement,true);
});
test('failed later waypoint page never returns a partial successful export',async()=>{
 const api=module('src/adapters/map/fetch-project-waypoints.js','DG_FETCH_PROJECT_WAYPOINTS'),x=pointClient({failPage:true});
 const result=await api.fetch({client:x.client,projectId:7});assert.equal(result.data,null);assert.equal(result.error.message,'page failed');
});
test('renumbering cannot reuse a measurement number even when it has no waypoint',async()=>{
 const api=module('src/adapters/map/mark-waypoint-visited.js','DG_MARK_WAYPOINT_VISITED');let writes=0,point;
 const client={from(table){const q={select(){return q;},eq(column,value){if(column==='point_id')point=value;return q;},limit(){return q;},update(){writes++;return q;},maybeSingle:async()=>({data:table==='measurements'?(point===9?{id:42}:null):{id:1},error:null})};return q;}};
 await assert.rejects(()=>api.moveWaypoint({client,change:{id:1,projectId:7,oldWpId:2,wpId:9,lat:39,lon:32}}),/ölçüm|Ölçüm/);assert.equal(writes,0);
});
