import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('admin panel actions preserve service calls and accessible archive disclosure',()=>{
 const source=read('../src/ui/admin-panel-actions.js'),listeners=new Map(),calls=[],window={};
 window.loadParkAdmin=()=>calls.push('parks');window.dgLoadPublishQueue=()=>calls.push('queue');
 const body={style:{display:'none'}};
 const button={dataset:{dgAdminPanelAction:'toggle-closed-requests'},attrs:{'aria-expanded':'false','aria-controls':'closedReqBody'},getAttribute(k){return this.attrs[k];},setAttribute(k,v){this.attrs[k]=v;}};
 const document={addEventListener:(name,fn)=>listeners.set(name,fn),getElementById:id=>id==='closedReqBody'?body:null};
 vm.runInContext(source,vm.createContext({window,document}));
 for(const action of ['reload-parks','reload-publish-queue'])listeners.get('click')({target:{closest:()=>({dataset:{dgAdminPanelAction:action}})}});
 const click=()=>listeners.get('click')({target:{closest:()=>button}});
 click();assert.equal(body.style.display,'block');assert.equal(button.attrs['aria-expanded'],'true');
 click();assert.equal(body.style.display,'none');assert.equal(button.attrs['aria-expanded'],'false');
 assert.deepEqual(calls,['parks','queue']);
});

test('account recovery and world report actions route to established workflows',()=>{
 const calls=[],listeners=[],window={saveNewPassword:()=>calls.push('save'),cancelRecovery:()=>calls.push('cancel'),parkReport:()=>calls.push('report')};
 const document={addEventListener:(name,fn)=>{if(name==='click')listeners.push(fn);}};
 for(const path of ['../src/ui/account-recovery-actions.js','../src/ui/world-report-actions.js'])vm.runInContext(read(path),vm.createContext({window,document}));
 for(const action of ['save-recovery-password','cancel-recovery'])listeners[0]({target:{closest:()=>({dataset:{dgAccountAction:action}})}});
 listeners[1]({target:{closest:()=>({dataset:{dgWorldAction:'create-report'}})}});
 assert.deepEqual(calls,['save','cancel','report']);
});

test('the final shell actions are declarative, booted, and cached offline',()=>{
 const shell=read('../partials/shell.html'),boot=read('../partials/boot.html'),sw=read('../sw.js');
 assert.doesNotMatch(shell,/<button[^>]*\bonclick\s*=/i);
 assert.doesNotMatch(shell,/<div[^>]*\bonclick\s*=/i);
 for(const name of ['admin-panel-actions','account-recovery-actions','world-report-actions']){
  assert.match(boot,new RegExp(`src/ui/${name}\\.js`));
  assert.match(sw,new RegExp(`/src/ui/${name}\\.js`));
 }
 assert.match(shell,/aria-controls="closedReqBody"/);assert.match(shell,/data-dg-world-action="create-report"/);
});

test('async font stylesheet activates after a paint frame without an inline event',()=>{
 const source=read('../src/ui/activate-async-stylesheets.js'),window={requestAnimationFrame:fn=>frames.push(fn)},link={media:'print'},frames=[];
 const document={querySelectorAll:()=>[link]};
 vm.runInContext(source,vm.createContext({window,document,setTimeout,requestAnimationFrame:fn=>frames.push(fn)}));
 assert.equal(link.media,'print');assert.equal(frames.length,1);frames[0]();assert.equal(link.media,'all');
 const head=read('../partials/head.html');assert.match(head,/data-dg-async-stylesheet/);assert.doesNotMatch(head,/\bonload\s*=/i);
});
