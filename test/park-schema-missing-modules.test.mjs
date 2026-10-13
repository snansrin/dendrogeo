import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const modules=[
  'src/domain/parks/is-schema-error.js',
  'src/application/parks/handle-park-schema-missing.js',
  'src/ui/park-schema-warning.js',
  'src/ui/park-schema-missing-feedback.js'
];
function setup(){const window={};const context=vm.createContext({window});for(const path of modules)vm.runInContext(read(path),context,{filename:path});return window;}

test('schema handler leaves permission and network errors usable without warning deactivation',()=>{
  const api=setup(),events=[];let warned=false,enabled=true;
  const feedback=api.DG_PARK_SCHEMA_MISSING_FEEDBACK.create({warn:(...args)=>events.push(['warn',...args]),toast:(...args)=>events.push(['toast',...args]),isAdmin:()=>false});
  const handle=api.DG_HANDLE_PARK_SCHEMA_MISSING_APPLICATION.create({isSchemaError:()=>false,hasWarned:()=>warned,markWarned:()=>{warned=true;},disableSchema:()=>{enabled=false;},notifyTransient:feedback.notifyTransient,notifyMissing:feedback.notifyMissing,renderCard:()=>events.push(['render'])});
  assert.equal(handle.handle({code:'42501',message:'permission denied'}).status,'transient-error');
  assert.equal(enabled,true);assert.equal(warned,false);assert.equal(events[0][0],'warn');assert.equal(events[1][1],'⚠ Park kimliği geçici olarak okunamadı (yetki/ağ). Şema sorunu değil — sayfayı yenileyin.');
});

test('real schema errors disable the gate once and preserve role-specific migration feedback order',()=>{
  const api=setup(),events=[];let warned=false,enabled=true;
  const feedback=api.DG_PARK_SCHEMA_MISSING_FEEDBACK.create({warn:(...args)=>events.push(['warn',...args]),toast:(...args)=>events.push(['toast',...args]),isAdmin:()=>true});
  const handle=api.DG_HANDLE_PARK_SCHEMA_MISSING_APPLICATION.create({isSchemaError:api.DG_PARK_SCHEMA_CAPABILITY.isSchemaError,hasWarned:()=>warned,markWarned:()=>{warned=true;},disableSchema:()=>{enabled=false;},notifyTransient:feedback.notifyTransient,notifyMissing:feedback.notifyMissing,renderCard:()=>events.push(['render'])});
  assert.equal(handle.handle({code:'42P01',message:'relation public.parks does not exist'}).status,'schema-missing');
  assert.equal(enabled,false);assert.equal(warned,true);
  assert.deepEqual(events.map(event=>event[0]),['warn','toast','render']);
  assert.match(events[1][1],/supabase\/migrations\/0004_parks\.sql/);
  assert.equal(handle.handle({code:'PGRST205'}).status,'already-warned');assert.equal(events.length,3);
});

test('schema display and feedback modules load before the locked park registry and stay precached',()=>{
  const head=read('partials/head.html'),sw=read('sw.js');
  for(const path of [...modules,'src/ui/park-schema-warning.js']){assert.ok(head.includes(`src="${path}?v=`));assert.ok(sw.includes(`'/${path}'`));assert.ok(head.indexOf(`src="${path}?v=`)<head.indexOf('src="src/services/park-registry.js?'));}
});
