import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {checkArchitecture} from '../scripts/check-architecture.mjs';

test('existing domain and application modules respect architecture boundaries',()=>{
  const result=checkArchitecture();
  assert.deepEqual(result.errors,[]);
  assert.ok(result.checked>0);
});

test('boundary checker rejects infrastructure globals but permits injected ports',()=>{
  const root=mkdtempSync(join(tmpdir(),'dendrogeo-architecture-'));
  try{
    mkdirSync(join(root,'src','domain'),{recursive:true});
    mkdirSync(join(root,'src','application'),{recursive:true});
    writeFileSync(join(root,'src','domain','bad.js'),'function bad(){ return fetch("/"); }');
    writeFileSync(join(root,'src','application','bad.js'),'function bad(){ return sb.from("x"); }');
    writeFileSync(join(root,'src','application','good.js'),'function good(ports){ return ports.fetch("/"); }');
    const result=checkArchitecture(root);
    assert.equal(result.checked,3);
    assert.equal(result.errors.length,2);
    assert.match(result.errors.join('\n'),/domain\/bad\.js: global network access/);
    assert.match(result.errors.join('\n'),/application\/bad\.js: direct Supabase access/);
  }finally{
    rmSync(root,{recursive:true,force:true});
  }
});
