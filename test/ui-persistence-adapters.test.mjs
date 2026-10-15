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

test('auth adapter keeps session, auth commands, realtime auth and profile results intact',async()=>{
 const api=moduleApi('src/adapters/auth/session-store.js','DG_AUTH_SESSION_STORE'),calls=[];
 const profile={data:{id:'u1',role:'admin'},error:null},session={data:{session:{access_token:'jwt'}},error:null},listener=()=>{},authResult={data:{user:{id:'u1'}},error:null};
 const client={auth:{getSession:async()=>session,onAuthStateChange:callback=>{calls.push(['listen',callback]);return listener;},signInWithPassword:async credentials=>{calls.push(['password',credentials]);return authResult;},signUp:async credentials=>{calls.push(['signup',credentials]);return authResult;},resetPasswordForEmail:async(email,options)=>{calls.push(['reset',email,options]);return authResult;},signOut:async options=>{calls.push(['signout',options]);return authResult;},updateUser:async attributes=>{calls.push(['update',attributes]);return authResult;},signInWithOAuth:async options=>{calls.push(['oauth',options]);return authResult;}},realtime:{setAuth:async token=>calls.push(['auth',token])},from(table){calls.push(['from',table]);return{select(columns){calls.push(['select',columns]);return{eq(column,value){calls.push(['eq',column,value]);return{single:async()=>profile};}};}};}};
 const store=api.create(()=>client);
 assert.equal(await store.getSession(),session);
 assert.equal(store.onAuthStateChange(()=>{}),listener);
 const credentials={email:'a@example.com',password:'secret'},resetOptions={redirectTo:'/reset'},oauthOptions={provider:'google'};
 assert.equal(await store.signInWithPassword(credentials),authResult);
 assert.equal(await store.signUp(credentials),authResult);
 assert.equal(await store.resetPasswordForEmail(credentials.email,resetOptions),authResult);
 assert.equal(await store.signOut(),authResult);
 assert.equal(await store.updatePassword('new-secret'),authResult);
 const profileMetadata={institution:'Example University'};assert.equal(await store.updateProfileMetadata(profileMetadata),authResult);
 assert.equal(await store.signInWithOAuth(oauthOptions),authResult);
 await store.setRealtimeAuth('jwt');
 assert.equal(await store.loadProfile('u1'),profile);
 const plainCalls=JSON.parse(JSON.stringify(calls,(key,value)=>typeof value==='function'?'callback':value));
 assert.deepEqual(plainCalls,[['listen','callback'],['password',credentials],['signup',credentials],['reset',credentials.email,resetOptions],['signout',{scope:'local'}],['update',{password:'new-secret'}],['update',{data:{dendrogeo_profile:profileMetadata}}],['oauth',oauthOptions],['auth','jwt'],['from','profiles'],['select','*'],['eq','id','u1']]);
});

test('persistence boundary rejects direct queries in both application and UI layers',()=>{
 const modules=[
  {layer:'application',relativePath:'src/application/example.js',source:'client.from("measurements"); client.auth.getSession(); client.channel("presence");'},
  {layer:'ui',relativePath:'src/ui/example.js',source:'sb.from("profiles"); sb.auth.signOut(); sb.channel("presence"); supabaseClient.storage.from("photos");'},
  {layer:'adapters',relativePath:'src/adapters/example.js',source:'client.from("measurements");'}
 ];
 const violations=findDirectPersistenceAccess(modules);
 assert.equal(violations.length,7);
 assert.ok(violations.some(message=>message.startsWith('src/ui/example.js:1:')));
});
