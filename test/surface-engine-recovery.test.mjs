import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const read=path=>readFileSync(join(root,path),'utf8');

test('karo sonuç birleştirme modülü alanları ve hücre/run sırasını deterministik toplar',()=>{
 const ctx={window:null,Object,Math,Number,Array};ctx.window=ctx;vm.createContext(ctx);
 vm.runInContext(read('src/domain/surface/merge-tile-results.js'),ctx);
 const a={assignedAreaM2:12,classifiedAreaM2:10,maskedAreaM2:2,maskedCount:1,sourceCells:3,
   groupCounts:{green:2},groupAreas:{green:8},rawCounts:{10:2},rawAreas:{10:8},runs:[{id:'a'}],cells:[{id:'a'}]};
 const b={assignedAreaM2:8,classifiedAreaM2:8,maskedAreaM2:0,sourceCells:2,
   groupCounts:{green:1,hard:1},groupAreas:{green:3,hard:5},rawCounts:{10:1,50:1},rawAreas:{10:3,50:5},runs:[{id:'b'}],cells:[{id:'b'}]};
 ctx.parts=[a,b];
 const out=vm.runInContext('DG_SURFACE_TILE_MERGER.merge(parts)',ctx);
 assert.deepEqual(JSON.parse(JSON.stringify(out)),{
  assignedAreaM2:20,classifiedAreaM2:18,maskedAreaM2:2,maskedCount:1,sourceCells:5,
  groupCounts:{green:3,hard:1},groupAreas:{green:11,hard:5},
  rawCounts:{10:3,50:1},rawAreas:{10:11,50:5},runs:[{id:'a'},{id:'b'}],cells:[{id:'a'},{id:'b'}]
 });
 assert.equal(a.assignedAreaM2,12,'girdi karoları değiştirilmemeli');
});

test('lc-engine eski dgLcMergeTileResults API adını domain modülüne yönlendirir',()=>{
 const ctx={window:null,Object,Math,Number,Array,Promise,AbortController,setTimeout,clearTimeout};ctx.window=ctx;vm.createContext(ctx);
 vm.runInContext(read('src/domain/surface/merge-tile-results.js'),ctx);
 vm.runInContext(read('src/services/lc-engine.js'),ctx);
 const out=vm.runInContext('dgLcMergeTileResults([{assignedAreaM2:4,classifiedAreaM2:3,maskedAreaM2:1,sourceCells:2,groupCounts:{green:1},groupAreas:{green:3},rawCounts:{10:1},rawAreas:{10:3},runs:[],cells:[]}])',ctx);
 assert.equal(out.assignedAreaM2,4);
 assert.equal(out.groupAreas.green,3);
});

test('eski motor kilidi yürürlükten kalktı; kurtarma snapshotı salt arşiv olarak kaldı',()=>{
 const record=JSON.parse(read('docs/surface-engine-lock.json'));
 const pkg=JSON.parse(read('package.json'));
 const ci=read('.github/workflows/ci.yml');
 assert.equal(record.status,'RETIRED_BY_USER');
 assert.equal(record.policy,'ARCHIVE_ONLY_NO_ENFORCEMENT');
 assert.equal(record.recovery_branch,'recovery/analysis-engine-20261009');
 assert.ok(!pkg.scripts.check.includes('check:surface-lock'));
 assert.ok(!ci.includes('check-surface-lock.mjs'));
});
