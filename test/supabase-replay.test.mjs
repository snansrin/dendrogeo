import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

test('every historical migration replays offline and fresh-install security contracts hold',()=>{
 const result=spawnSync(process.execPath,['scripts/verify-supabase-replay.mjs'],{
  cwd:fileURLToPath(new URL('../',import.meta.url)),encoding:'utf8',timeout:60000
 });
 assert.equal(result.status,0,result.stderr||result.stdout);
 const report=JSON.parse(result.stdout);
 assert.equal(report.status,'passed');assert.equal(report.completed,report.total);
 assert.equal(report.contracts,'passed');assert.equal(report.securityMigrationIdempotent,true);
 assert.equal(report.public_tables,14);
});
