import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const modules=[
  'src/domain/parks/select-park-live-collaborators.js',
  'src/domain/parks/build-park-live-collaborator-view.js',
  'src/ui/prepare-park-live-collaborator-layer.js',
  'src/ui/render-park-live-collaborator-marker.js',
  'src/ui/render-park-live-collaborator-count.js'
];
function setup(){const window={};const context=vm.createContext({window,String,Math});for(const path of modules)vm.runInContext(read(path),context,{filename:path});return window;}

test('Presence selection preserves order and excludes self or members without coordinates',()=>{
  const select=setup().DG_SELECT_PARK_LIVE_COLLABORATORS.select,presence={a:[{id:1,la:1,lo:2},{id:2,la:null,lo:3}],b:[null,{id:3,la:4,lo:5}]};
  assert.deepEqual(JSON.parse(JSON.stringify(select({presence,currentUserId:1}))),[{id:3,la:4,lo:5}]);
});

test('collaborator view derives a localized initial and elapsed time without mutating presence',()=>{
  const build=setup().DG_BUILD_PARK_LIVE_COLLABORATOR_VIEW.build,member={id:'b',n:'  Ömer',la:39,lo:32,t:1000};
  const view=build({member,color:id=>'blue',now:61000,format:value=>value});
  assert.deepEqual(JSON.parse(JSON.stringify(view)),{lat:39,lon:32,name:'  Ömer',initial:'Ö',color:'blue',ageLabel:'1 dk'});assert.equal(member.t,1000);
});

test('Leaflet collaborator layer is created once and cleared for each sync',()=>{
  const prepare=setup().DG_PREPARE_PARK_LIVE_COLLABORATOR_LAYER.prepare,calls=[],map={},layer={clearLayers:()=>calls.push('clear')};let current=null;
  const leaflet={layerGroup:()=>({addTo:target=>{calls.push(['add',target]);return layer;}})},ports={layer:current,map,leaflet,setLayer:value=>{current=value;}};
  assert.equal(prepare(ports),layer);assert.equal(current,layer);ports.layer=current;assert.equal(prepare(ports),layer);assert.deepEqual(calls.map(value=>Array.isArray(value)?'add':value),['add','clear','clear']);
});

test('marker renderer escapes text and keeps the existing icon, z-order and tooltip contract',()=>{
  const render=setup().DG_RENDER_PARK_LIVE_COLLABORATOR_MARKER.render,calls=[],layer={},leaflet={divIcon:options=>{calls.push(['icon',options]);return'icon';},marker:(coords,options)=>({addTo(target){calls.push(['marker',coords,options,target]);return{bindTooltip:(html,settings)=>calls.push(['tooltip',html,settings])};}})};
  render({layer,leaflet,member:{},view:{lat:39,lon:32,color:'#123',initial:'<',name:'<Ada>',ageLabel:'5 sn'},escape:value=>String(value).replaceAll('<','&lt;').replaceAll('>','&gt;'),translate:value=>'T:'+value});
  assert.equal(calls[0][1].iconAnchor[0],9);assert.match(calls[0][1].html,/&lt;/);assert.equal(calls[1][2].zIndexOffset,600);assert.equal(calls[1][2].keyboard,false);assert.match(calls[2][1],/<b>&lt;Ada&gt;<\/b>/);assert.match(calls[2][1],/T:son konum/);assert.equal(calls[2][2].direction,'top');
});

test('summary reports the collaborator count and clears when no peers remain',()=>{
  const render=setup().DG_RENDER_PARK_LIVE_COLLABORATOR_COUNT.render,box={textContent:'old'};
  render({element:box,count:2,translate:(value,vars)=>value.replace('{n}',vars.n)});assert.match(box.textContent,/2 ortak/);
  render({element:box,count:0,translate:value=>value});assert.equal(box.textContent,'');
});

test('presence rendering modules load before the locked map service and are precached',()=>{
  const head=read('partials/head.html'),sw=read('sw.js'),map=read('src/services/map.js');
  for(const path of modules){assert.ok(head.includes(`src="${path}?v=`),`${path} script`);assert.ok(sw.includes(`'/${path}'`),`${path} precache`);assert.ok(head.indexOf(`src="${path}?v=`)<head.indexOf('src="src/services/map.js?'),`${path} precedes locked service`);}
  for(const name of ['DG_SELECT_PARK_LIVE_COLLABORATORS','DG_BUILD_PARK_LIVE_COLLABORATOR_VIEW','DG_PREPARE_PARK_LIVE_COLLABORATOR_LAYER','DG_RENDER_PARK_LIVE_COLLABORATOR_MARKER','DG_RENDER_PARK_LIVE_COLLABORATOR_COUNT'])assert.ok(map.includes(name));
});
