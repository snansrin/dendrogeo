import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
function load(paths,window={},extra={}){const context=vm.createContext({window,...extra});for(const path of paths)vm.runInContext(read(path),context);return{window,context};}

test('completion follows saved project measurement evidence, never legacy visited flags',async()=>{
 const{window}=load(['src/adapters/map/fetch-project-waypoints.js']);
 const calls=[],points=[{wp_id:1,visited:true},{wp_id:2,visited:false},{wp_id:3},{wp_id:4},{wp_id:5}],measurements=[
  {point_id:2,girth_cm:100,height_m:8,status:'Beklemede'},
  {point_id:3,girth_cm:100,height_m:8,status:'Reddedildi'},
  {point_id:4,girth_cm:null,dbh_cm:20,height_m:8,status:'Onaylandı'},
  {point_id:5,girth_cm:100,height_m:0,status:'Beklemede'}
 ];
 let failure=false;
 const client={from(table){const query={select(){return query;},eq(field,value){calls.push([table,field,value]);return query;},in(){return query;},order(){return table==='waypoints'?Promise.resolve({data:points}):query;},range(start){calls.push(['range',start]);return Promise.resolve(failure?{error:{message:'denied'}}:{data:start===0?Array.from({length:1000},()=>measurements[0]):measurements});}};return query;}};
 const result=await window.DG_FETCH_PROJECT_WAYPOINTS.fetch({client,projectId:7});
 assert.deepEqual(Array.from(result.data,row=>row.visited),[false,true,false,true,false]);
 assert.equal(points[0].visited,true,'source rows must remain untouched');
 assert.deepEqual(calls.filter(row=>row[0]==='range'),[['range',0],['range',1000]]);
 assert.ok(calls.filter(row=>row[1]==='project_id').every(row=>row[2]===7));
 failure=true;const failed=await window.DG_FETCH_PROJECT_WAYPOINTS.fetch({client,projectId:7});
 assert.equal(failed.data,null);assert.equal(failed.error.message,'denied');
});

test('phone arrow updates without a GPS fix, handles wrap, landscape, stale and relative sensors',async()=>{
 const events={},timers=[],clock={now:()=>10000};let requested=0;
 const{window}=load(['src/ui/render-waypoint-gps-guidance-readout.js'],{
  addEventListener:(name,callback)=>events[name]=callback,setTimeout:callback=>timers.push(callback),
  screen:{orientation:{angle:0}},DeviceOrientationEvent:{requestPermission:async()=>{requested++;return'granted';}}
 },{Date:clock});
 const elements={navDist:{},navTarget:{},navArrow:{style:{}}},ui=window.DG_RENDER_WAYPOINT_GPS_GUIDANCE_READOUT;
 ui.render({target:{wp_id:3},meters:40,targetBearing:10,getElement:id=>elements[id],translate:value=>value});
 assert.equal(elements.navArrow.style.visibility,'hidden');
 events.deviceorientation({alpha:100,absolute:false});assert.equal(elements.navArrow.style.visibility,'hidden');
 await ui.start();assert.equal(requested,1);
 events.deviceorientation({webkitCompassHeading:350,webkitCompassAccuracy:5});assert.equal(elements.navArrow.style.transform,'rotate(20deg)');
 events.deviceorientationabsolute({type:'deviceorientationabsolute',alpha:270});assert.equal(elements.navArrow.style.transform,'rotate(280deg)');
 window.screen.orientation.angle=90;events.deviceorientationabsolute({type:'deviceorientationabsolute',alpha:270});assert.equal(elements.navArrow.style.transform,'rotate(190deg)');
 clock.now=()=>16000;timers.at(-1)();assert.equal(elements.navArrow.style.visibility,'hidden');
 ui.render({target:{wp_id:3},meters:40,targetBearing:10,gps:{heading:30,speed:1},getElement:id=>elements[id],translate:value=>value});assert.equal(elements.navArrow.style.transform,'rotate(340deg)');
});

test('four new broadleaf species use the frozen group fallback and preserve conifer values',()=>{
 const{context}=load(['src/config/wood-density-lock.js','src/config/species.js']);
 for(const name of ['Zeytin','iğde','süs kirazı','güvey kandili']){
  assert.equal(vm.runInContext(`SPECIES_GROUP[resolveSpeciesName(${JSON.stringify(name)})]`,context),'YAPRAKLI');
  assert.equal(vm.runInContext(`densityKgFor(${JSON.stringify(name)},'YAPRAKLI')`,context),541);
  assert.equal(vm.runInContext(`densityKgFor(${JSON.stringify(name)},'İBRELİ')`,context),null);
 }
 assert.equal(vm.runInContext("densityKgFor('DİĞER İBRELİ','İBRELİ')",context),446);
 assert.equal(vm.runInContext("densityKgFor('KIZILÇAM','İBRELİ')",context),478);
});
