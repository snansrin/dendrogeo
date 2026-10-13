import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const files=[
 'src/application/auth/show-password-recovery.js',
 'src/ui/show-auth-panel.js',
 'src/application/auth/select-auth-tab.js',
 'src/ui/render-auth-message.js',
 'src/application/auth/start-google-sign-in.js'
];
function load(){
 const window={},context=vm.createContext({window,Array,Object,String,Promise});
 for(const file of files)vm.runInContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),context);
 return window;
}

test('password recovery opens only for the matching auth event',()=>{
 const api=load().DG_SHOW_PASSWORD_RECOVERY,modal={style:{display:'none'}};
 assert.equal(api.show('SIGNED_IN',()=>modal),false);assert.equal(modal.style.display,'none');
 assert.equal(api.show('PASSWORD_RECOVERY',()=>modal),true);assert.equal(modal.style.display,'flex');
 assert.equal(api.show('PASSWORD_RECOVERY',()=>null),false);
});

test('show auth panel keeps scroll, tab, glow and timeout order',()=>{
 const api=load().DG_SHOW_AUTH_PANEL,events=[],element={scrollIntoView:options=>events.push(['scroll',options])},box={offsetWidth:8,classList:{remove:value=>events.push(['remove',value]),add:value=>events.push(['add',value])}};
 assert.equal(api.show(null,box,'reg',{selectTab(){},schedule(){}}),false);
 assert.equal(api.show(element,box,'reg',{selectTab:value=>events.push(['tab',value]),schedule:(fn,ms)=>events.push(['schedule',ms])}),true);
 assert.deepEqual(JSON.parse(JSON.stringify(events)),[['scroll',{behavior:'smooth'}],['tab','reg'],['remove','auth-glow'],['add','auth-glow'],['schedule',3000]]);
});

test('auth tab changes visible form and initializes the matching captcha afterward',()=>{
 const api=load().DG_SELECT_AUTH_TAB,events=[],elements=Object.fromEntries(['fLogin','fReg','fReset'].map(id=>[id,{style:{}}]));
 const selected=api.select('reset',{getElement:id=>elements[id],setTab:value=>events.push(['tab',value]),markVisible:()=>events.push('visible'),loadCaptcha:()=>events.push('load'),initializeCaptcha:()=>events.push('initialize')});
 assert.equal(selected,'reset');assert.deepEqual(Object.fromEntries(Object.entries(elements).map(([id,value])=>[id,value.style.display])),{fLogin:'none',fReg:'none',fReset:'block'});
 assert.deepEqual(events,[['tab','reset'],'visible','load','initialize']);
});

test('auth message preserves textContent and success/error colors',()=>{
 const api=load().DG_RENDER_AUTH_MESSAGE,element={textContent:'',style:{}};
 assert.equal(api.render('<unsafe>',true,element),true);assert.equal(element.textContent,'<unsafe>');assert.equal(element.style.color,'var(--red)');
 api.render('Ready',false,element);assert.equal(element.style.color,'var(--green-dk)');assert.equal(api.render('ignored',false,null),false);
});

test('Google OAuth keeps account-selection redirect and restores the button on provider failure',async()=>{
 const api=load().DG_START_GOOGLE_SIGN_IN,events=[];
 const success=await api.start({setButtonDisabled:value=>events.push(['disabled',value]),showMessage:(...args)=>events.push(['message',...args]),showWait:value=>events.push(['wait',value]),hideWait:()=>events.push('hide'),redirectTo:()=>{events.push('redirect');return'https://site.test/path/';},signIn:options=>{events.push(['oauth',options]);return{data:{},error:null};}});
 assert.equal(success.status,'redirecting');assert.deepEqual(JSON.parse(JSON.stringify(events.slice(0,5))),[['disabled',true],['message','Google\'a yönlendiriliyorsun…',false],['wait','🔵 Google\'a yönlendiriliyorsun…'],'redirect',['oauth',{provider:'google',options:{redirectTo:'https://site.test/path/',queryParams:{prompt:'select_account'}}}]]);
 const failureEvents=[];
 const failure=await api.start({setButtonDisabled:value=>failureEvents.push(['disabled',value]),showMessage:(...args)=>failureEvents.push(['message',...args]),showWait:()=>failureEvents.push('wait'),hideWait:()=>failureEvents.push('hide'),redirectTo:()=>'/return/',signIn:async()=>({error:{message:'provider not enabled'}})});
 assert.equal(failure.status,'failed');assert.match(failure.message,/Supabase.*Google.*Enable/);assert.deepEqual(failureEvents.slice(0,4),[['disabled',true],['message','Google\'a yönlendiriliyorsun…',false],'wait',['disabled',false]]);assert.equal(failureEvents[4],'hide');
});

test('auth service delegates the five entry workflows and keeps the OAuth compatibility fallback',()=>{
 const source=readFileSync(new URL('../src/services/auth.js',import.meta.url),'utf8');
 for(const api of ['DG_SHOW_PASSWORD_RECOVERY','DG_SHOW_AUTH_PANEL','DG_SELECT_AUTH_TAB','DG_RENDER_AUTH_MESSAGE','DG_START_GOOGLE_SIGN_IN'])assert.ok(source.includes('window.'+api));
 assert.match(source,/async function dgGoogleSignIn\(/);assert.match(source,/sb\.auth\.signInWithOAuth\(\{/);assert.match(source,/window\.dgGoogleSignIn=dgGoogleSignIn;/);
});
