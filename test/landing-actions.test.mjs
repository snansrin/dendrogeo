import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../src/ui/landing-actions.js',import.meta.url),'utf8');

test('landing click actions preserve auth modes and invoke the established window APIs',()=>{
  const listeners=new Map(),calls=[];
  const window={};
  for(const name of ['dgNavToggle','dgToggleLang','showAuth','dgGoogleSignIn','authTab','doLogin','doRegister','sendResetEmail'])
    window[name]=function(...args){calls.push([name,this===window,...args]);};
  const document={addEventListener:(name,handler)=>listeners.set(name,handler)};
  vm.runInContext(source,vm.createContext({window,document}));
  const cases=[
    ['nav-toggle','dgNavToggle'],['toggle-language','dgToggleLang'],['show-auth','showAuth'],
    ['google-sign-in','dgGoogleSignIn'],['auth-tab','authTab'],['login','doLogin'],
    ['register','doRegister'],['send-reset','sendResetEmail']
  ];
  for(const [action] of cases){
    const element={dataset:{dgLandingAction:action,dgAuthMode:action==='auth-tab'?'reset':action==='show-auth'?'reg':undefined}};
    listeners.get('click')({target:{closest:selector=>selector==='[data-dg-landing-action]'?element:null}});
  }
  assert.deepEqual(calls.map(([name])=>name),cases.map(([,name])=>name));
  assert.ok(calls.every(([,receiver])=>receiver));
  assert.deepEqual(calls[2],['showAuth',true,'reg']);
  assert.deepEqual(calls[4],['authTab',true,'reset']);
});

test('landing auth forms keep native submit navigation prevented',()=>{
  const listeners=new Map(),document={addEventListener:(name,handler)=>listeners.set(name,handler)};
  vm.runInContext(source,vm.createContext({window:{},document}));
  let prevented=false;
  listeners.get('submit')({target:{matches:selector=>selector==='[data-dg-auth-form]'},preventDefault(){prevented=true;}});
  assert.equal(prevented,true);
  listeners.get('submit')({target:{matches:()=>false},preventDefault(){throw Error('unrelated form should retain its behavior');}});
});
