import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const context=vm.createContext({window:{}});
vm.runInContext(readFileSync(new URL('../src/application/parks/evaluate-measurement-park-gate.js',import.meta.url),'utf8'),context);
const create=context.window.DG_PARK_MEASUREMENT_GATE_APPLICATION.create;

function gate(overrides={}){
  return create({schemaReady:()=>true,editing:()=>false,hasGate:()=>true,getProject:()=>({id:7,park_id:3,park_name:'Göksu'}),isAdmin:()=>false,redirectAlreadyUsed:()=>false,...overrides});
}

test('schema fallback, missing UI, and edit mode keep measurement available',()=>{
  assert.equal(gate({schemaReady:()=>false})().status,'schema-unavailable');
  assert.equal(gate({hasGate:()=>false})().status,'gate-unavailable');
  assert.equal(gate({editing:()=>true,getProject:()=>({id:7,park_id:null})})().allowed,true);
});

test('a project without a park is locked and offers admin-specific guidance state',()=>{
  const admin=gate({getProject:()=>({id:8,name:'Eski'}),isAdmin:()=>true,redirectAlreadyUsed:()=>true});
  const result=admin(true);
  assert.equal(result.status,'park-required');
  assert.equal(result.allowed,false);
  assert.equal(result.isAdmin,true);
  assert.equal(result.redirect,null);
});

test('missing project is locked and redirects only when the caller allows it',()=>{
  const evaluate=gate({getProject:()=>null});
  assert.equal(JSON.stringify(evaluate(true)),JSON.stringify({status:'project-required',allowed:false,project:null,redirect:{returnTo:'measure'}}));
  assert.equal(evaluate(false).redirect,null);
});

test('linked project returns current park display data',()=>{
  const result=gate({getProject:()=>({id:7,park_id:3,parks:{name:'Göksu Parkı',area_m2:423000}})})();
  assert.equal(result.status,'ready');
  assert.equal(result.allowed,true);
  assert.equal(result.parkName,'Göksu Parkı');
  assert.equal(result.areaM2,423000);
});
