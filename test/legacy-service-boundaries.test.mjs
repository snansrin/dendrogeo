import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {compareServiceBoundaryDebt,scanServiceBoundaryDebt} from '../scripts/check-service-boundaries.mjs';

function fixture(source){
  const root=mkdtempSync(join(tmpdir(),'dg-service-boundary-'));
  mkdirSync(join(root,'src/services'),{recursive:true});
  if(source!==undefined)writeFileSync(join(root,'src/services/legacy.js'),source);
  return root;
}
const baseline=files=>({schema:'dendrogeo/legacy-service-boundaries/v1',files});

test('legacy service boundary budget allows existing access and reductions',()=>{
  const root=fixture('document.querySelector("#old"); sb.from("legacy");');
  try{
    const current=scanServiceBoundaryDebt(root);
    const result=compareServiceBoundaryDebt(current,baseline(current));
    assert.deepEqual(result.errors,[]);assert.equal(result.introduced,0);
    assert.match(compareServiceBoundaryDebt({},baseline(current)).errors.join('\n'),/baseline service is missing/);
  }finally{rmSync(root,{recursive:true,force:true});}
});

test('a new or increased legacy DOM, persistence, or network boundary fails',()=>{
  const root=fixture('document.querySelector("#new"); sb.from("new"); fetch("/new");');
  try{
    const baselineDebt={
      'src/services/legacy.js':{dom:1,persistence:1,network:0}
    };
    const result=compareServiceBoundaryDebt(scanServiceBoundaryDebt(root),baseline(baselineDebt));
    assert.equal(result.errors.length,1);
    assert.match(result.errors.join('\n'),/network sınır borcu 0 → 1 arttı/);
  }finally{rmSync(root,{recursive:true,force:true});}
});

test('Supabase auth, Storage, Realtime, RPC and Edge Function access count as persistence crossings',()=>{
  const root=fixture('sb.storage.from("photos"); client.auth.getSession(); supabase.realtime.setAuth("token"); supabaseClient.rpc("run"); sb.functions.invoke("job");');
  try{
    const current=scanServiceBoundaryDebt(root);
    assert.equal(current['src/services/legacy.js'].persistence,5);
  }finally{rmSync(root,{recursive:true,force:true});}
});

test('unknown or missing boundary baseline fails closed',()=>{
  assert.equal(compareServiceBoundaryDebt({},null).errors.length,1);
  assert.equal(compareServiceBoundaryDebt({},baseline(null)).errors.length,1);
});

test('a service cannot disappear from the baseline and erase its debt',()=>{
  const debt=baseline({'src/services/removed.js':{dom:1,persistence:0,network:0}});
  assert.match(compareServiceBoundaryDebt({},debt).errors.join('\n'),/src\/services\/removed\.js: baseline service is missing/);
});
