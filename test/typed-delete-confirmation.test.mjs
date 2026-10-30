import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/ui/typed-delete-confirmation.js',import.meta.url),'utf8');

function fakeDocument(lang='tr'){
  const elements=[];
  const doc={documentElement:{lang},activeElement:null};
  class Element {
    constructor(tag){this.tag=tag;this.children=[];this.events={};this.isConnected=true;elements.push(this);}
    setAttribute(name,value){this[name]=value;}
    appendChild(child){this.children.push(child);child.parent=this;return child;}
    append(...children){for(const child of children)this.appendChild(child);}
    addEventListener(type,callback){(this.events[type]??=[]).push(callback);}
    dispatch(type){for(const callback of this.events[type]||[])callback({preventDefault(){},target:this});}
    showModal(){if(this.tag!=='dialog')throw Error('not a dialog');this.open=true;}
    close(){this.open=false;this.dispatch('close');}
    remove(){this.isConnected=false;if(this.parent)this.parent.children=this.parent.children.filter(item=>item!==this);}
    focus(){doc.activeElement=this;}
  }
  doc.createElement=tag=>new Element(tag);
  doc.body=new Element('body');
  doc.activeElement=new Element('button');
  return {doc,elements,find:kind=>elements.find(item=>item.id===kind)};
}

function setup(lang='tr'){
  const dom=fakeDocument(lang),window={document:dom.doc};
  vm.runInContext(source,vm.createContext({window}));
  return {...dom,api:window.DG_TYPED_DELETE_CONFIRM};
}

test('typed deletion tokens are bound to exact operation and id',()=>{
  const {api}=setup();
  assert.equal(api.requiredText('project',7),'SİL PROJE 7');
  assert.equal(api.requiredText('park',9),'SİL PARK 9');
  assert.equal(api.requiredText('measurement',42),'SİL KAYIT 42');
  assert.equal(api.requiredText('park',9,'en'),'DELETE PARK 9');
  assert.equal(api.requiredText('measurement',42,'en'),'DELETE RECORD 42');
  for(const wrong of ['sil proje 7','SİL PROJE 8','SİL PARK 7','SİL',''])assert.equal(api.matches('project',7,wrong),false);
  assert.equal(api.matches('project',7,'SİL PROJE 7'),true);
  for(const invalid of [null,-1,0,'12; DROP TABLE parks','',undefined])assert.equal(api.requiredText('project',invalid),'');
});

test('modal disables permanent delete until exact written authorization, then restores focus',async()=>{
  const {api,doc,find,elements}=setup(),trigger=doc.activeElement;
  const result=api.ask({kind:'park',id:12,name:'Göksu <img src=x>',warning:'ÖLÇÜM SİLİNMEZ'});
  const dialog=elements.find(item=>item.tag==='dialog'),input=find('dgTypedDeleteInput'),form=elements.find(item=>item.tag==='form');
  const accept=elements.find(item=>item.type==='submit');
  assert.equal(dialog.open,true);assert.equal(accept.disabled,true);
  assert.equal(elements.some(item=>item.textContent==='Göksu <img src=x> · #12'),true);
  input.value='SİL PARK 13';input.dispatch('input');form.dispatch('submit');
  assert.equal(dialog.open,true);assert.equal(accept.disabled,true);
  input.value='SİL PARK 12';input.dispatch('input');assert.equal(accept.disabled,false);
  form.dispatch('submit');assert.equal(await result,true);
  assert.equal(dialog.open,false);assert.equal(doc.activeElement,trigger);
});

test('escape, explicit cancellation, duplicate prompts and unsupported dialogs fail closed',async()=>{
  const {api,elements}=setup(),first=api.ask({kind:'project',id:20});
  assert.equal(await api.ask({kind:'project',id:21}),false);
  const dialog=elements.find(item=>item.tag==='dialog');dialog.dispatch('cancel');dialog.close();
  assert.equal(await first,false);
  const second=api.ask({kind:'measurement',id:55}),cancel=elements.findLast(item=>item.textContent==='Vazgeç');
  cancel.dispatch('click');assert.equal(await second,false);
  const context={window:{document:{body:{appendChild(){}},createElement:()=>({})}}};
  vm.runInContext(source,vm.createContext(context));
  assert.equal(await context.window.DG_TYPED_DELETE_CONFIRM.ask({kind:'project',id:1}),false);
});

test('written deletion module loads before owners and admins and is available offline',()=>{
  const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
  const head=read('partials/head.html'),sw=read('sw.js');
  const path='src/ui/typed-delete-confirmation.js';
  assert.ok(head.includes(path));assert.ok(sw.includes("'/"+path+"'"));
  for(const dependency of ['src/ui/confirm-measurement-project-delete.js','src/ui/park-admin-mutation.js','src/services/dash.js','src/services/admin.js','src/services/admin-tree.js']){
    assert.ok(head.indexOf(path)<head.indexOf(dependency),dependency);
  }
});
