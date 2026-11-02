import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const modules=[
  'src/domain/parks/parse-waypoint-csv.js',
  'src/domain/parks/validate-waypoint-csv-row.js',
  'src/application/parks/build-waypoint-upsert-command.js',
  'src/adapters/parks/upsert-project-waypoint.js',
  'src/application/parks/upload-waypoint-csv.js'
];
function setup(){const window={};const context=vm.createContext({window,String,Number,Math,Object,Array});for(const path of modules)vm.runInContext(read(path),context,{filename:path});return window;}

test('CSV parser recognizes DendroGeo headers, strips BOM, and preserves the coordinate-first format',()=>{
  const parse=setup().DG_PARSE_WAYPOINT_CSV.parse;
  assert.deepEqual(JSON.parse(JSON.stringify(parse('\uFEFFlon,lat,id\r\n"32.1",39.2,7\r\n\r\n181,90,8'))),[['32.1','39.2','7',''],['181','90','8','']]);
});

test('CSV parser understands Google Maps saved-place and My Maps headers, quoted descriptions, and generated IDs',()=>{
  const parser=setup().DG_PARSE_WAYPOINT_CSV;
  const saved=parser.analyze('Title,Note,URL,Address,Latitude,Longitude\r\n"My tree, north","near gate",https://maps.google.com,Ankara,39.9123,32.8123');
  assert.equal(saved.format,'header-coordinates');assert.equal(saved.delimiter,',');
  assert.deepEqual(JSON.parse(JSON.stringify(saved.rows)),[['32.8123','39.9123','1','generated']]);
  const myMaps=parser.parse('Name,Description,Latitude,Longitude\nP 14,"tree, old oak",39.91,32.81');
  assert.deepEqual(JSON.parse(JSON.stringify(myMaps)),[['32.81','39.91','14','']]);
});

test('CSV parser accepts semicolon decimal-comma exports, WKT points, tabs and headerless coordinates',()=>{
  const parse=setup().DG_PARSE_WAYPOINT_CSV.parse;
  assert.deepEqual(JSON.parse(JSON.stringify(parse('Name;WKT\nTree 4;"POINT (32,8123 39,9123)"'))),[['32.8123','39.9123','4','']]);
  assert.deepEqual(JSON.parse(JSON.stringify(parse('longitude\tlatitude\tname\n32.8\t39.9\tOak'))),[['32.8','39.9','1','generated']]);
  assert.deepEqual(JSON.parse(JSON.stringify(parse('32.8,39.9,1\n32.7,39.8,2'))),[['32.8','39.9','1',''],['32.7','39.8','2','']]);
});

test('row validation keeps geographic bounds and requires positive integer IDs',()=>{
  const validate=setup().DG_VALIDATE_WAYPOINT_CSV_ROW.validate;
  assert.deepEqual(JSON.parse(JSON.stringify(validate(['180','90','7']))),{lon:180,lat:90,id:7});
  for(const row of [['181','0','1'],['0','-91','1'],['0','0','0'],['0','0','1.2'],['','0','1'],['0','0']])assert.equal(validate(row),null);
});

test('upsert command preserves owner, project fields, and the existing conflict key',()=>{
  const build=setup().DG_BUILD_WAYPOINT_UPSERT_COMMAND.build;
  assert.deepEqual(JSON.parse(JSON.stringify(build({owner:'u1',projectId:12,waypoint:{id:8,lat:39,lon:32}}))),{row:{owner:'u1',project_id:12,wp_id:8,lat:39,lon:32},options:{onConflict:'project_id,wp_id'}});
});

test('Supabase adapter performs one upsert and propagates PostgREST errors',async()=>{
  const upsert=setup().DG_UPSERT_PROJECT_WAYPOINT.upsert,events=[],command={row:{project_id:3,wp_id:1},options:{onConflict:'project_id,wp_id'}};
  const client={from:table=>({upsert:async(row,options)=>{events.push([table,row,options]);return{error:null};}})};
  assert.equal(await upsert({client,command}),true);assert.deepEqual(JSON.parse(JSON.stringify(events[0])),['waypoints',command.row,command.options]);
  await assert.rejects(()=>upsert({client:{from:()=>({upsert:async()=>({error:new Error('denied')})})},command}),/denied/);
});

test('application uploads valid rows sequentially, counts rejects, reports outcome, and refreshes',async()=>{
  const upload=setup().DG_UPLOAD_WAYPOINT_CSV.upload,events=[];let active=0,maxActive=0;
  const result=await upload({projectId:4,file:{text:async()=> 'lon,lat,id\n32,39,1\n181,0,2\n33,40,3'},owner:'u',parse:()=>[['32','39','1'],['181','0','2'],['33','40','3']],validate:cells=>cells[0]==='181'?null:{id:Number(cells[2]),lat:Number(cells[1]),lon:Number(cells[0])},build:input=>input,upsert:async value=>{active++;maxActive=Math.max(maxActive,active);events.push(['save',value.waypoint.id]);await Promise.resolve();active--;},notify:(...args)=>events.push(['notify',...args]),refresh:async()=>events.push(['refresh']),translate:value=>value});
  assert.deepEqual(JSON.parse(JSON.stringify(result)),{saved:2,invalid:1,protectedRows:0,unchanged:0,conflicts:0});assert.equal(maxActive,1);assert.deepEqual(events,[['save',1],['save',3],['notify','✓ 2 ölçüm noktası kaydedildi. 1 geçersiz satır atlandı.','warn'],['refresh']]);
});

test('partial failure reports completed rows before refreshing the current list',async()=>{
  const upload=setup().DG_UPLOAD_WAYPOINT_CSV.upload,events=[];let attempts=0;
  const result=await upload({projectId:4,file:{text:async()=>''},owner:'u',parse:()=>[[1],[2]],validate:cells=>({id:cells[0]}),build:input=>input,upsert:async()=>{if(++attempts===2)throw new Error('RLS');},notify:(...args)=>events.push(['notify',...args]),refresh:async()=>events.push(['refresh']),translate:value=>value});
  assert.deepEqual(JSON.parse(JSON.stringify(result)),{saved:1,invalid:0,protectedRows:0,unchanged:0,conflicts:0});assert.deepEqual(events,[['notify','Ölçüm noktası yükleme hatası: RLS · 1 satır kaydedildi.','err'],['refresh']]);
});

test('CSV imports assign anonymous IDs above current points and never move measured points',async()=>{
  const upload=setup().DG_UPLOAD_WAYPOINT_CSV.upload,events=[],writes=[];
  const result=await upload({projectId:4,file:{text:async()=>''},owner:'u',parse:()=>[['32','39','1','generated'],['34','40','5',''],['34','41','6','']],validate:cells=>({lon:+cells[0],lat:+cells[1],id:+cells[2],...(cells[3]==='generated'?{generated:true}:{})}),build:input=>input,upsert:async value=>writes.push(value.waypoint),existingWaypoints:[{project_id:4,wp_id:1,lat:38,lon:31,visited:false},{project_id:4,wp_id:5,lat:40,lon:33,visited:true}],notify:(...args)=>events.push(args),refresh:async()=>{},translate:value=>value});
  assert.deepEqual(JSON.parse(JSON.stringify(result)),{saved:2,invalid:0,protectedRows:1,unchanged:0,conflicts:0});
  assert.deepEqual(JSON.parse(JSON.stringify(writes)),[{lon:32,lat:39,id:7,generated:true},{lon:34,lat:41,id:6}]);
  assert.match(events[0][0],/1 ölçüm kaydı korundu/);
});

test('waypoint modules load before the locked map service and are precached',()=>{
  const head=read('partials/head.html'),sw=read('sw.js'),map=read('src/services/map.js');
  for(const path of modules){assert.ok(head.includes(`src="${path}?v=`),`${path} script`);assert.ok(sw.includes(`'/${path}'`),`${path} precache`);assert.ok(head.indexOf(`src="${path}?v=`)<head.indexOf('src="src/services/map.js?'),`${path} precedes locked service`);}
  for(const name of ['DG_PARSE_WAYPOINT_CSV','DG_VALIDATE_WAYPOINT_CSV_ROW','DG_BUILD_WAYPOINT_UPSERT_COMMAND','DG_UPSERT_PROJECT_WAYPOINT','DG_UPLOAD_WAYPOINT_CSV'])assert.ok(map.includes(name));
});
