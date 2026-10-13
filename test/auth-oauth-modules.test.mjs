import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const files=[
 'src/domain/auth/is-oauth-callback.js',
 'src/domain/auth/read-oauth-error.js',
 'src/application/auth/wait-for-oauth-session.js',
 'src/application/auth/clean-oauth-url.js',
 'src/ui/oauth-wait-indicator.js'
];
function load(window={}){
 const context=vm.createContext({window:{...window},Promise,Number,String,decodeURIComponent,setTimeout,clearTimeout});
 for(const file of files)vm.runInContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),context,{filename:file});
 return context.window;
}

test('OAuth callback detection and error decoding accept only the existing URL signals',()=>{
 const api=load({location:{search:'?code=abc',hash:''}});
 assert.equal(api.DG_AUTH_OAUTH_CALLBACK.isCallback(api.location),true);
 assert.equal(api.DG_AUTH_OAUTH_CALLBACK.isCallback({search:'',hash:'#access_token=abc'}),true);
 assert.equal(api.DG_AUTH_OAUTH_CALLBACK.isCallback({search:'?error=access_denied',hash:''}),true);
 assert.equal(api.DG_AUTH_OAUTH_CALLBACK.isCallback({search:'?state=abc',hash:''}),false);
 assert.equal(api.DG_AUTH_OAUTH_ERROR.read('?error=access_denied&state=x'),'access_denied');
 assert.equal(api.DG_AUTH_OAUTH_ERROR.read('?state=x'),null);
});

test('OAuth session wait accepts sign-in and unsubscribes the auth listener',async()=>{
 const api=load(),events={};let unsubscribed=0;
 const client={auth:{onAuthStateChange(callback){events.callback=callback;return{data:{subscription:{unsubscribe(){unsubscribed++;}}}};},getSession:async()=>({data:{session:null}})}};
 const ports={onAuthStateChange:callback=>client.auth.onAuthStateChange(callback),getSession:()=>client.auth.getSession()};
 const pending=api.DG_AUTH_OAUTH_SESSION.wait(ports,5000);
 events.callback('SIGNED_IN',{user:{id:'u1'}});
 assert.equal((await pending).user.id,'u1');
 assert.equal(unsubscribed,1);
});

test('OAuth session wait resolves a session already present during code exchange',async()=>{
 const api=load(),session={user:{id:'u2'}};let unsubscribed=0;
 const client={auth:{onAuthStateChange(){return{data:{subscription:{unsubscribe(){unsubscribed++;}}}};},getSession:async()=>({data:{session}})}};
 const ports={onAuthStateChange:callback=>client.auth.onAuthStateChange(callback),getSession:()=>client.auth.getSession()};
 assert.equal(await api.DG_AUTH_OAUTH_SESSION.wait(ports,5000),session);
 assert.equal(unsubscribed,1);
});

test('OAuth URL cleanup keeps only pathname and safely tolerates history errors',()=>{
 const calls=[],host={history:{replaceState:(...args)=>calls.push(args)},location:{pathname:'/projects'}};
 const api=load();api.DG_CLEAN_OAUTH_URL.clean(host);
 assert.deepEqual(calls,[[null,'','/projects']]);
 api.DG_CLEAN_OAUTH_URL.clean({history:{replaceState(){throw Error('blocked');}},location:{pathname:'/'}});
});

test('OAuth wait indicator preserves the original label and visibility states',()=>{
 const api=load(),el={style:{},textContent:''};
 const getElement=id=>id==='oauthWait'?el:null;
 api.DG_AUTH_OAUTH_WAIT_UI.show(getElement,'🔵 Google\'a yönlendiriliyorsun…');
 assert.equal(el.style.display,'block');assert.match(el.textContent,/Google/);
 api.DG_AUTH_OAUTH_WAIT_UI.show(getElement);
 assert.equal(el.textContent,'⏳ Google girişi tamamlanıyor…');
 api.DG_AUTH_OAUTH_WAIT_UI.hide(getElement);assert.equal(el.style.display,'none');
});
