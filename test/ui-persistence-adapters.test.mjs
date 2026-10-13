import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {findDirectPersistenceAccess} from '../scripts/lib/dependency-direct-persistence.mjs';

function moduleApi(path,name){
 const window={},context=vm.createContext({window});
 vm.runInContext(readFileSync(new URL('../'+path,import.meta.url),'utf8'),context);
 return window[name];
}

test('landing statistics adapter keeps parallel independent reads and partial failures',async()=>{
 const api=moduleApi('src/adapters/world/world-stats-store.js','DG_WORLD_STATS_STORE'),calls=[];
 const client={from(view){calls.push(view);return{select(){if(view==='v_global')return this;if(view==='v_city')return Promise.reject(Error('offline'));return Promise.resolve({data:[{country:'TR'}],error:Error('denied')});},single(){return Promise.resolve({data:{records:4},error:null});}};}};
 const result=await api.loadForLanding(client);
 assert.deepEqual(calls,['v_global','v_country','v_city']);
 assert.equal(result.global.data.records,4);
 assert.equal(result.countries,null);
 assert.equal(result.cities,null);
 assert.equal(result.errors.length,2);
});

test('auth session adapter keeps SDK session, auth listener, realtime auth and profile results intact',async()=>{
 const api=moduleApi('src/adapters/auth/session-store.js','DG_AUTH_SESSION_STORE'),calls=[];
 const profile={data:{id:'u1',role:'admin'},error:null},session={data:{session:{access_token:'jwt'}},error:null},listener=()=>{};
 const client={auth:{getSession:async()=>session,onAuthStateChange:callback=>{calls.push(['listen',callback]);return listener;}},realtime:{setAuth:async token=>calls.push(['auth',token])},from(table){calls.push(['from',table]);return{select(columns){calls.push(['select',columns]);return{eq(column,value){calls.push(['eq',column,value]);return{single:async()=>profile};}};}};}};
 const store=api.create(()=>client);
 assert.equal(await store.getSession(),session);
 assert.equal(store.onAuthStateChange(()=>{}),listener);
 await store.setRealtimeAuth('jwt');
 assert.equal(await store.loadProfile('u1'),profile);
 const plainCalls=JSON.parse(JSON.stringify(calls,(key,value)=>typeof value==='function'?'callback':value));
 assert.deepEqual(plainCalls,[['listen','callback'],['auth','jwt'],['from','profiles'],['select','*'],['eq','id','u1']]);
});

test('persistence boundary rejects direct queries in both application and UI layers',()=>{
 const modules=[
  {layer:'application',relativePath:'src/application/example.js',source:'client.from("measurements"); client.auth.getSession(); client.channel("presence");'},
  {layer:'ui',relativePath:'src/ui/example.js',source:'sb.from("profiles");'},
  {layer:'adapters',relativePath:'src/adapters/example.js',source:'client.from("measurements");'}
 ];
 assert.equal(findDirectPersistenceAccess(modules).length,4);
});
