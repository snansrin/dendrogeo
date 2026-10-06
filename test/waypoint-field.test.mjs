import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
function field(){
 const els=new Map(),writes=[],messages=[];
 const $=id=>{if(!els.has(id))els.set(id,{value:'',textContent:'',innerHTML:'',style:{},files:[]});return els.get(id);};
 $('nProject').value='7';
 const ctx=vm.createContext({$,window:{},WP:[{id:1,wp_id:12,lat:40,lon:32,project_id:7,visited:false},{id:2,wp_id:20,lat:40,lon:33,project_id:7,visited:true}],navTarget:null,navMap:null,GPS:null,manualPoint:false,USER:{id:'u'},hav:()=>25,toast:(...a)=>messages.push(a),confirm:()=>true,dgCf:s=>s,dgTfs:(s,v)=>s,go:v=>ctx.view=v,sb:{from:()=>({upsert:async r=>{writes.push(r);return {error:ctx.fail?Error('network'):null};},update:r=>({eq:async()=>{writes.push(r);return {error:null};}})})}});
 vm.runInContext(readFileSync(new URL('../src/services/map.js',import.meta.url),'utf8'),ctx);
 return {ctx,$,writes,messages,run:s=>vm.runInContext(s,ctx)};
}
test('search and status filter combine without changing waypoint state',()=>{const f=field();f.$('wpSearch').value='P12';f.$('wpFilter').value='pending';f.run('renderWaypointList()');assert.match(f.$('wpListTable').innerHTML,/P12/);assert.doesNotMatch(f.$('wpListTable').innerHTML,/P20/);assert.equal(f.ctx.WP.length,2);assert.match(f.$('navInfo').textContent,/1 bekleyen/);});
test('target is visible with GPS off and distance is reset',async()=>{const f=field();f.$('navDist').textContent='100 m';await f.run('selectWaypoint(1)');assert.equal(f.$('navTarget').textContent,'Hedef: P12');assert.equal(f.$('navDist').textContent,'—');assert.match(f.$('navGps').textContent,/GPS konumu bekleniyor/);});
test('list distance and GPS accuracy are shown when location is available',()=>{const f=field();f.ctx.GPS={latitude:40,longitude:32,accuracy:6};f.run('drawNav()');assert.match(f.$('wpListTable').innerHTML,/25 m/);assert.match(f.$('navGps').textContent,/±6 m/);});
test('arrival carries selected point and project to measurement',async()=>{const f=field();f.ctx.loadWaypoints=async()=>{};f.ctx.navTarget=f.ctx.WP[0];await f.run('arriveWp()');assert.equal(f.$('mProject').value,'7');assert.equal(f.$('mPoint').value,12);assert.equal(f.ctx.view,'measure');assert.equal(f.writes[0].visited,true);});
test('CSV rejects invalid coordinates and accepts zero coordinates',async()=>{const f=field();f.ctx.loadWaypoints=async()=>{};f.$('nCsv').files=[{text:async()=> 'X,Y,id\n0,0,1\n32,91,2\nInfinity,40,3\n32,40,4.5\n,40,5'}];await f.run('uploadWpCsv()');assert.equal(f.writes.length,1);assert.equal(f.writes[0].lat,0);assert.match(f.messages[0][0],/4 geçersiz/);});
test('CSV write failure is reported without claiming successful upload',async()=>{const f=field();f.ctx.loadWaypoints=async()=>{};f.ctx.fail=true;f.$('nCsv').files=[{text:async()=> 'X,Y,id\n32,40,1'}];await f.run('uploadWpCsv()');assert.match(f.messages[0][0],/yükleme hatası.*0 satır/);assert.equal(f.messages[0][1],'err');});
test('nearest pending target ignores visited points and never writes data',()=>{const f=field();f.ctx.GPS={latitude:40,longitude:32,accuracy:5};f.ctx.hav=(_a,_b,_c,lon)=>lon===32?100:10;f.ctx.WP.push({id:3,wp_id:30,lat:40,lon:33,project_id:7,visited:false});f.run('dgNearestWaypoint()');assert.equal(f.ctx.navTarget.id,3);assert.equal(f.writes.length,0);});
test('nearest target requires GPS, warns and keeps the user in waypoint',()=>{const f=field();f.ctx.view='nav';f.run('dgNearestWaypoint()');assert.equal(f.ctx.navTarget,null);assert.equal(f.ctx.view,'nav');assert.equal(f.messages[0][1],'warn');});
test('next target follows point order, skips visited points and wraps',()=>{const f=field();f.ctx.WP.push({id:3,wp_id:30,lat:40,lon:33,project_id:7,visited:false});f.run('dgNextWaypoint()');assert.equal(f.ctx.navTarget.wp_id,12);f.run('dgNextWaypoint()');assert.equal(f.ctx.navTarget.wp_id,30);f.run('dgNextWaypoint()');assert.equal(f.ctx.navTarget.wp_id,12);assert.equal(f.writes.length,0);});
test('distance sorting leaves the source waypoint order intact',()=>{const f=field();f.ctx.GPS={latitude:40,longitude:32,accuracy:5};f.ctx.hav=(_a,_b,_c,lon)=>lon===32?100:10;f.$('wpSort').value='distance';f.run('renderWaypointList()');const html=f.$('wpListTable').innerHTML;assert.ok(html.indexOf('P20')<html.indexOf('P12'));assert.equal(f.ctx.WP[0].wp_id,12);});
test('map focus frames user and target or target alone without GPS',()=>{const f=field();const calls=[];f.ctx.navMap={fitBounds:(p,o)=>calls.push({p,o}),setView:(p,z)=>calls.push({p,z})};f.ctx.navTarget=f.ctx.WP[0];f.run('dgFocusWaypoint()');assert.equal(calls[0].z,18);f.ctx.GPS={latitude:39,longitude:31,accuracy:5};f.run('dgFocusWaypoint()');assert.equal(calls[1].p.length,2);assert.equal(calls[1].o.maxZoom,18);});
test('all-points extent includes completed points and current location',()=>{const f=field();let bounds;f.ctx.navMap={fitBounds:p=>bounds=p};f.ctx.GPS={latitude:39,longitude:31,accuracy:5};f.run('dgFitWaypoints()');assert.equal(bounds.length,3);});
test('guidance distinguishes GPS uncertainty from approaching the target',()=>{const f=field();f.ctx.navTarget=f.ctx.WP[0];f.ctx.GPS={latitude:40,longitude:32,accuracy:30};f.run('dgWaypointGuidance()');assert.match(f.$('navGuidance').textContent,/belirsizlik/);f.ctx.GPS.accuracy=5;f.run('dgWaypointGuidance()');assert.match(f.$('navGuidance').textContent,/yaklaştınız/);assert.equal(f.writes.length,0);});
test('300 waypoints render only eight rows; search finds a far point directly',()=>{const f=field();f.ctx.WP=Array.from({length:300},(_,i)=>({id:i+1,wp_id:i+1,lat:40,lon:32,visited:false}));f.run('renderWaypointList()');assert.equal((f.$('wpListTable').innerHTML.match(/<li /g)||[]).length,8);assert.match(f.$('wpPager').innerHTML,/1–8 \/ 300/);f.run('dgWaypointPage(1)');assert.match(f.$('wpPager').innerHTML,/9–16 \/ 300/);f.$('wpSearch').value='P300';f.run('renderWaypointList()');assert.match(f.$('wpListTable').innerHTML,/P300/);assert.equal((f.$('wpListTable').innerHTML.match(/<li /g)||[]).length,1);});

test('waypoint UI keeps only the map collapsible and all field controls visible',()=>{
 const shell=readFileSync(new URL('../partials/shell.html',import.meta.url),'utf8');
 const a=shell.indexOf('<div class="view" id="v-nav">'),b=shell.indexOf('<div class="view" id="v-map">',a),nav=shell.slice(a,b);
 assert.match(nav,/<details id="wpMapPanel"/);
 assert.equal((nav.match(/<details\b/g)||[]).length,1);
 assert.match(nav,/class="card waypoint-nav-card"/);
 assert.match(nav,/id="wpSearch"/);assert.match(nav,/id="wpFilter"/);assert.match(nav,/id="wpSort"/);
 assert.match(nav,/class="card waypoint-files"/);
 assert.doesNotMatch(nav,/waypoint-coordinates/);
});
test('all-points action can open the map without changing waypoint data',()=>{const f=field();const panel=f.$('wpMapPanel');panel.open=false;let fit=0;f.ctx.navMap={fitBounds:()=>fit++,invalidateSize:()=>{}};f.run('dgFitWaypoints(true)');assert.equal(panel.open,true);assert.equal(fit,1);assert.equal(f.writes.length,0);});
