import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const modules=[
  'src/domain/parks/resolve-park-geometry-backfill-area.js',
  'src/adapters/parks/park-geometry-backfill-store.js',
  'src/ui/park-geometry-backfill-feedback.js',
  'src/application/parks/backfill-park-geometry.js'
];
function setup(){const window={};const context=vm.createContext({window});for(const path of modules)vm.runInContext(read(path),context,{filename:path});return window;}

test('backfill area keeps rounded OSM area or falls back to the registered park area',()=>{
  const resolve=setup().DG_RESOLVE_PARK_GEOMETRY_BACKFILL_AREA.resolve;
  assert.equal(resolve(1549.7,1200),1550);
  assert.equal(resolve(0,1200),1200);
  assert.equal(resolve(Number.NaN,1200),1200);
});

test('geometry store preserves park read shape and RLS-scoped update chain',async()=>{
  const api=setup(),calls=[];
  const client={from(table){calls.push(['from',table]);return{
    select(columns){calls.push(['select',columns]);return{eq(field,id){calls.push(['read-eq',field,id]);return{maybeSingle:async()=>({data:{id:7}})};}};},
    update(payload){calls.push(['update',payload]);return{eq:async(field,id)=>{calls.push(['write-eq',field,id]);return{error:null};}};}
  };}};
  const store=api.DG_PARK_GEOMETRY_BACKFILL_STORE.create({getClient:()=>client});
  assert.deepEqual({...await store.getPark(7)},{id:7});
  const update={geom_json:{outer:[]},area_m2:1550};
  assert.deepEqual({...await store.saveGeometry(7,update)},{error:null});
  assert.deepEqual(JSON.parse(JSON.stringify(calls)),[
    ['from','parks'],['select','*'],['read-eq','id',7],
    ['from','parks'],['update',update],['write-eq','id',7]
  ]);
});

test('geometry backfill UI retains escaped messages and translated errors',()=>{
  const api=setup(),messages=[];
  const feedback=api.DG_PARK_GEOMETRY_BACKFILL_FEEDBACK.create({
    toast:(...args)=>messages.push(args),escape:value=>`escaped:${value}`,format:value=>`EN:${value}`
  });
  feedback.notify('loading');
  feedback.notify('osm-error',null,{message:'<offline>'});
  feedback.notify('boundary-not-found');
  feedback.notify('write-error',null,{message:'RLS'});
  feedback.notify('saved',{name:'<park>'});
  assert.deepEqual(JSON.parse(JSON.stringify(messages)),[
    ['🛰 OSM sınırı çekiliyor…','info','🛰'],
    ['EN:OSM hatası: escaped:<offline>','err','🛰'],
    ["OSM'de kapalı sınır bulunamadı (relation parçalı olabilir).",'warn','🛰'],
    ['EN:Yazılamadı (yetki/ağ): escaped:RLS','err','🛰'],
    ['✓ escaped:<park> geometrisi yazıldı — çit artık tam poligonla.','ok','🛰']
  ]);
});

test('geometry backfill use case injects area policy before the unchanged write boundary',async()=>{
  const api=setup(),events=[],park={id:7,area_m2:1200};
  const backfill=api.DG_PARK_GEOMETRY_BACKFILL_APPLICATION.create({
    isAdmin:()=>true,getPark:async()=>park,fetchRing:async()=>({outer:[]}),calculateArea:()=>1549.7,
    resolveArea:(area,currentPark)=>{events.push(['area',area,currentPark.area_m2]);return 1500;},
    saveGeometry:async(id,update)=>{events.push(['save',id,update]);return{error:null};},
    notify:kind=>events.push(['notify',kind]),onComplete:()=>events.push(['complete'])
  });
  const result=await backfill(7);
  assert.equal(result.areaM2,1500);
  assert.deepEqual(JSON.parse(JSON.stringify(events)),[
    ['notify','loading'],['area',1549.7,1200],['save',7,{geom_json:{outer:[]},area_m2:1500}],['notify','saved'],['complete']
  ]);
});

test('geometry backfill modules load before the locked park registry and are precached',()=>{
  const head=read('partials/head.html'),sw=read('sw.js');
  for(const path of modules){assert.ok(head.includes(`src="${path}?v=`));assert.ok(sw.includes(`'/${path}'`));assert.ok(head.indexOf(`src="${path}?v=`)<head.indexOf('src="src/services/park-registry.js?'));}
});
