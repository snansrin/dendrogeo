import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const context=vm.createContext({window:{}});
vm.runInContext(readFileSync(new URL('../src/application/parks/create-project.js',import.meta.url),'utf8'),context);
const create=context.window.DG_PARK_CREATE_PROJECT_APPLICATION.create;

function setup(overrides={}){
  const calls=[];
  const fn=create({
    getUser:()=>({id:'user-1'}),getPark:()=>({id:7,name:'Göksu Parkı',city:'Ankara',country:'Türkiye'}),
    getLabel:()=> 'batı',projectName:(park,label)=>`${park} - ${label}`,
    insertProject:async row=>{calls.push(['insert',row]);return{data:{id:19,...row},error:null};},
    persistGeometry:async park=>calls.push(['geometry',park.id]),...overrides
  });
  return{fn,calls};
}

test('creates a linked project, then persists its park geometry',async()=>{
  const a=setup();
  const result=await a.fn();
  assert.equal(result.status,'created');
  assert.deepEqual(JSON.parse(JSON.stringify(a.calls)),[
    ['insert',{owner:'user-1',park_id:7,label:'batı',name:'Göksu Parkı - batı',city:'Ankara',country:'Türkiye'}],
    ['geometry',7]
  ]);
});

test('requires a signed-in user and a registered park before writing',async()=>{
  const noUser=setup({getUser:()=>null});
  assert.equal((await noUser.fn()).status,'unauthenticated');
  assert.equal(noUser.calls.length,0);
  const noPark=setup({getPark:()=>null});
  assert.equal((await noPark.fn()).status,'park-missing');
  assert.equal(noPark.calls.length,0);
});

test('reports write failure without persisting geometry',async()=>{
  const error={message:'denied'};
  const a=setup({insertProject:async()=>({data:null,error})});
  const result=await a.fn();
  assert.equal(result.status,'write-failed');
  assert.equal(result.error,error);
  assert.deepEqual(a.calls,[]);
});
