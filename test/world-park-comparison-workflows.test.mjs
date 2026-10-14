import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const modules=['src/domain/parks/resolve-park-comparison-read.js','src/application/world/load-park-comparison.js',
 'src/ui/render-primary-park-comparison.js','src/application/world/load-legacy-park-comparison.js',
 'src/ui/show-park-comparison-denied.js'];
function load(){const window={},context=vm.createContext({window,Promise,Math,Number,Array,Object,String});for(const path of modules)vm.runInContext(read(path),context);return{window,context};}

test('park comparison read path keeps schema errors separate from denied reads',()=>{
 const resolver=load().window.DG_RESOLVE_PARK_COMPARISON_READ;
 assert.equal(resolver.resolve(null,()=>true),'primary');
 assert.equal(resolver.resolve({code:'42P01'},error=>error.code==='42P01'),'legacy');
 assert.equal(resolver.resolve({code:'42501'},()=>false),'denied');
});

test('primary loader uses fallback only for a schema error',async()=>{
 const api=load().window.DG_LOAD_PARK_COMPARISON,events=[];
 await api.execute({read:async()=>({data:[1],error:null}),resolve:()=> 'primary',onDenied(){},onSchemaMissing(){},loadLegacy(){},render:rows=>events.push(['render',rows])});
 await api.execute({read:async()=>({data:null,error:{code:'42P01'}}),resolve:()=> 'legacy',onDenied(){},onSchemaMissing:error=>events.push(['schema',error.code]),loadLegacy:()=>events.push('legacy'),render(){}});
 await api.execute({read:async()=>({data:null,error:{code:'42501'}}),resolve:()=> 'denied',onDenied:error=>events.push(['denied',error.code]),onSchemaMissing(){},loadLegacy(){},render(){}});
 assert.deepEqual(events,[['render',[1]],['schema','42P01'],'legacy',['denied','42501']]);
});

test('primary renderer stores rows before the optional panel guard and partitions output',()=>{
 const api=load().window.DG_RENDER_PRIMARY_PARK_COMPARISON,events=[],rows=[{park_id:1},{park_id:0}];
 const prepared={linked:[rows[0]],pending:[rows[1]],max:10};
 assert.equal(api.render(rows,{setRows:value=>events.push(['state',value]),prepare:()=>prepared,element:null}),null);
 const element={innerHTML:''};
 const result=api.render(rows,{setRows:value=>events.push(['state',value]),prepare:()=>prepared,element,
  renderLinked:(linked,max)=>String(linked.length)+'@'+max,renderPending:pending=>'|pending:'+pending.length,
  renderReportOptions:(linked,pending)=>events.push(['options',linked.length,pending.length])});
 assert.equal(element.innerHTML,'1@10|pending:1');assert.equal(result.max,10);
 assert.equal(events.filter(event=>event[0]==='state').length,2);
});

test('legacy loader warns at the established limit and forwards grouped rows',async()=>{
 const api=load().window.DG_LOAD_LEGACY_PARK_COMPARISON,events=[],rows=[{id:1}];
 const result=await api.execute({load:async()=>({data:rows,count:5001}),warnIfTruncated:(...args)=>events.push(['warn',...args]),
  setRows:value=>events.push(['state',value]),group:value=>({parks:value})});
 assert.equal(result.rows,rows);assert.equal(result.grouped.parks,rows);
 assert.deepEqual(events.map(event=>event[0]),['warn','state']);
 assert.deepEqual(events[0].slice(2),[5000,'Park karşılaştırma',5001]);
});

test('denied renderer reports the error without any schema-state port',()=>{
 const api=load().window.DG_SHOW_PARK_COMPARISON_DENIED,events=[],element={};
 api.show({code:'42501',message:'denied'},{isAdmin:()=>false,log:(...args)=>events.push(['log',...args]),
  getElement:()=>element,render:value=>'card:'+value.code,escape:String,toast:(...args)=>events.push(['toast',...args]),translate:value=>'tr:'+value});
 assert.equal(element.innerHTML,'card:42501');assert.equal(events[0][0],'log');assert.equal(events[1][0],'toast');
});

test('world service uses the extracted primary workflow and UI ports',async()=>{
 const{window,context}=load(),events=[],parkBox={innerHTML:''},reportBox={innerHTML:''};
 for(const path of ['src/adapters/world/park-comparison-store.js','src/domain/parks/prepare-park-comparison.js'])vm.runInNewContext(read(path),context);
 window.DG_PARK_COMPARISON_ROW={render:park=>'<article>'+park.park_name+'</article>'};
 window.DG_PARK_COMPARISON_PENDING={render:rows=>'<aside>'+rows.length+'</aside>'};
 window.DG_PARK_REPORT_OPTIONS_UI={render:(target,linked,pending)=>{target.innerHTML=linked.length+'/'+pending.length;}};
 const client={from(table){events.push(['from',table]);const query={select(){return query;},order(column,options){events.push(['order',column,options]);return query;},
  then(resolve){return Promise.resolve({data:[{park_id:5,park_name:'Main',carbon_kg:4},{park_id:0,park_name:'Pending',carbon_kg:2}],error:null}).then(resolve);}};return query;}};
 Object.assign(context,{sb:client,$:id=>id==='parkCompare'?parkBox:id==='repProject'?reportBox:null,esc:String,dgFmtHa:String,dgIsSchemaError:()=>false});
 vm.runInContext(read('src/services/world.js'),context);
 await vm.runInContext('loadParkCompare()',context);
 assert.deepEqual(JSON.parse(JSON.stringify(events)),[['from','v_park_compare'],['order','carbon_kg',{ascending:false}]]);
 assert.equal(parkBox.innerHTML,'<article>Main</article><aside>1</aside>');assert.equal(reportBox.innerHTML,'1/1');
});

test('all five world comparison modules load and are precached before the service',()=>{
 const head=read('partials/head.html'),cache=read('sw.js'),service=read('src/services/world.js');
 for(const path of modules){assert.ok(head.indexOf(path)<head.indexOf('src/services/world.js'));assert.ok(cache.includes('/'+path));}
 assert.match(service,/DG_LOAD_PARK_COMPARISON/);assert.match(service,/DG_LOAD_LEGACY_PARK_COMPARISON/);
});
