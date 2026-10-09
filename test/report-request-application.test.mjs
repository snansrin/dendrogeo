import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/application/reports/collect-publication-request.js',import.meta.url),'utf8');
function collector(deps){
 const context=vm.createContext({window:{},Set,JSON});
 vm.runInContext(source,context);
 return context.window.DG_REPORT_PUBLICATION_REQUEST_APPLICATION.createReportPublicationRequestCollector(deps);
}

test('aynı kullanıcı ve park için eşzamanlı istek tek kez toplanıp eklenir',async()=>{
 let resolveContext,insertions=0,submitted=[];
 const collect=collector({
  getRequestKey:id=>'user:'+id,getProjectName:()=>'Göksu saha çalışması',
  collectContext:async(parkId,name)=>{assert.equal(parkId,7);assert.equal(name,'Göksu saha çalışması');return new Promise(resolve=>{resolveContext=resolve;});},
  insertRequest:async(parkId,lulc,note)=>{insertions++;assert.equal(parkId,7);assert.equal(lulc,true);assert.deepEqual(JSON.parse(note),{confirmed:true});return{ok:true};},
  onSubmitted:key=>submitted.push(key)
 });
 const first=collect(7,true);
 assert.equal(await collect(7,true),null,'ikinci tıklama sessizce yok sayılır');
 resolveContext({confirmed:true});
 assert.deepEqual(await first,{ok:true});
 assert.equal(insertions,1);
 assert.deepEqual(submitted,['user:7']);
});

test('kullanıcı iptali dış servise yazmaz ve sonraki denemeye izin verir',async()=>{
 let calls=0,results=[null,{ok:true}];
 const collect=collector({
  getRequestKey:id=>'user:'+id,getProjectName:()=>'',
  collectContext:async()=>{calls++;return results.shift();},
  insertRequest:async()=>({ok:true}),onSubmitted:()=>{}
 });
 assert.equal(await collect(4,false),null);
 assert.deepEqual(await collect(4,false),{ok:true});
 assert.equal(calls,2);
});

test('ekleme başarısızsa taslak temizleme callbacki çalışmaz ve hata kilidi bırakır',async()=>{
 let cleared=0,calls=0;
 const collect=collector({
  getRequestKey:id=>'user:'+id,getProjectName:()=>'',
  collectContext:async()=>({confirmed:true}),
  insertRequest:async()=>{calls++;return{ok:false};},
  onSubmitted:()=>cleared++
 });
 assert.deepEqual(await collect(4,true),{ok:false});
 assert.deepEqual(await collect(4,true),{ok:false});
 assert.equal(calls,2);
 assert.equal(cleared,0);
});
