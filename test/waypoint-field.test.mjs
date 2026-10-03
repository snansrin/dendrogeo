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
