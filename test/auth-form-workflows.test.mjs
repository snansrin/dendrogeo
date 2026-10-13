import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const files=[
 'src/application/auth/login-with-password.js',
 'src/application/auth/register-account.js',
 'src/application/auth/send-password-reset-email.js',
 'src/application/auth/sign-out.js',
 'src/application/auth/save-new-password.js'
];
function load(){
 const window={},context=vm.createContext({window,Promise,Number,String,Object});
 for(const file of files)vm.runInContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),context,{filename:file});
 return window;
}

test('password login retries the captcha, loads the profile, starts the shell and schedules sync',async()=>{
 const api=load(),events=[],user={id:'u1'},profile={role:'owner'};let tokenReads=0;
 await api.DG_LOGIN_WITH_PASSWORD.execute({email:'a@example.test',password:'secret',token:()=>++tokenReads===1?null:'captcha',wait:async ms=>events.push(['wait',ms]),showMessage:(...args)=>events.push(['message',...args]),auth:{signInWithPassword:async payload=>{events.push(['sign-in',payload]);return{data:{user},error:null};}},resetWidget:id=>events.push(['reset',id]),setUser:value=>events.push(['user',value.id]),setProfile:value=>events.push(['profile',value.role]),loadProfile:async id=>{events.push(['load-profile',id]);return{data:profile};},startShell:()=>events.push('shell'),isOnline:()=>true,schedule:(fn,ms)=>events.push(['schedule',ms]),syncOffline:()=>events.push('sync')});
 assert.equal(events.filter(e=>e[0]==='wait')[0][1],2500);
 assert.deepEqual(JSON.parse(JSON.stringify(events.find(e=>e[0]==='sign-in')[1])),{email:'a@example.test',password:'secret',options:{captchaToken:'captcha'}});
 assert.ok(events.some(e=>Array.isArray(e)&&e[0]==='load-profile'&&e[1]==='u1'));
 assert.deepEqual(events.slice(-3),[['profile','owner'],'shell',['schedule',2000]]);
});

test('registration keeps consent gate and records timestamped KVKK metadata',async()=>{
 const api=load(),events=[];let submitted;
 const consent={checked:true,focus(){events.push('focus');}};
 await api.DG_REGISTER_ACCOUNT.execute({name:'Ada',email:'a@example.test',password:'secret',organization:'Forest Lab',consent,token:()=> 'captcha',wait:async()=>{},showMessage:(...args)=>events.push(['message',...args]),auth:{signUp:async value=>{submitted=value;return{data:{session:null},error:null};}},resetWidget:id=>events.push(['reset',id]),redirectTo:'https://dendrogeo.org/path/',now:()=> '2026-10-13T00:00:00.000Z'});
 assert.equal(submitted.options.data.kvkk_consent,true);
 assert.equal(submitted.options.data.kvkk_consent_at,'2026-10-13T00:00:00.000Z');
 assert.equal(submitted.options.data.kvkk_consent_source,'kayit-formu');
 assert.equal(submitted.options.redirectTo,'https://dendrogeo.org/path/');
 const rejected=await api.DG_REGISTER_ACCOUNT.execute({name:'Ada',email:'a@example.test',password:'secret',consent:{checked:false,focus(){events.push('focus');}},showMessage:(...args)=>events.push(['message',...args])});
 assert.equal(rejected,undefined);assert.equal(events.at(-1),'focus');
});

test('password reset preserves redirect and captcha reset on API failure',async()=>{
 const api=load(),events=[];
 await api.DG_SEND_PASSWORD_RESET_EMAIL.execute({email:'a@example.test',token:()=> 'captcha',wait:async()=>{},showMessage:(...args)=>events.push(['message',...args]),auth:{resetPasswordForEmail:async(...args)=>{events.push(['reset-request',...args]);return{error:new Error('denied')};}},resetWidget:id=>events.push(['reset-widget',id]),redirectTo:'https://dendrogeo.org/'});
 const request=events.find(e=>e[0]==='reset-request');
 assert.equal(request[2].redirectTo,'https://dendrogeo.org/');
 assert.ok(events.some(e=>e[0]==='reset-widget'&&e[1]==='tsReset'));
 assert.ok(events.some(e=>e[0]==='message'&&e[1]==='Hata: denied'));
});

test('sign out stops presence before auth sign-out and reload',async()=>{
 const api=load(),events=[];
 await api.DG_SIGN_OUT.execute({stopPresence:()=>events.push('presence'),signOut:async()=>events.push('sign-out'),reload:()=>events.push('reload')});
 assert.deepEqual(events,['presence','sign-out','reload']);
});

test('new password validation does not write until both local checks pass',async()=>{
 const api=load(),events=[];
 const ports={password:'short',confirmation:'other',updatePassword:async value=>{events.push(['update',value]);return{error:null};},setMessage:(...args)=>events.push(['message',...args]),toast:(...args)=>events.push(['toast',...args]),replaceHistory:()=>events.push('history'),reload:()=>events.push('reload')};
 await api.DG_SAVE_NEW_PASSWORD.execute(ports);assert.deepEqual(events,[['message','Parola en az 6 karakter olmalı.',true]]);
 await api.DG_SAVE_NEW_PASSWORD.execute({...ports,password:'long-enough',confirmation:'different'});assert.equal(events.at(-1)[1],'Parolalar eşleşmiyor.');
 await api.DG_SAVE_NEW_PASSWORD.execute({...ports,password:'long-enough',confirmation:'long-enough'});
 assert.deepEqual(events.slice(-4),[['update','long-enough'],['toast','✓ Parola güncellendi — yeni parolanızla giriş yapın','ok','🔑'],'history','reload']);
});
