import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readReportRuntimeProvenance} from '../scripts/lib/report-runtime-provenance.mjs';

test('runtime provenance reads authoritative versions and trims the commit',()=>{
  const paths=[];
  const result=readReportRuntimeProvenance({
    read:path=>{paths.push(path);return path==='package.json'?'{"version":"3.0.0"}':'const DG_LC_ENGINE_VERSION = "4.3.0";';},
    readGitCommit:()=> 'commit\n'
  });
  assert.deepEqual(result,{engineVersion:'4.3.0',appVersion:'3.0.0',gitCommit:'commit'});
  assert.deepEqual(paths,['src/services/lc-config.js','package.json']);
});

test('a failed engine source does not hide the app or commit source',()=>{
  assert.deepEqual(readReportRuntimeProvenance({
    read:path=>{if(path==='package.json')return '{"version":"3.0.0"}';throw Error('missing');},
    readGitCommit:()=> 'commit'
  }),{engineVersion:null,appVersion:'3.0.0',gitCommit:'commit'});
});

test('malformed or empty sources retain null instead of inventing provenance',()=>{
  assert.deepEqual(readReportRuntimeProvenance({read:()=> 'invalid',readGitCommit:()=> '  '}),{
    engineVersion:null,appVersion:null,gitCommit:null
  });
  assert.deepEqual(readReportRuntimeProvenance({read:()=>{throw Error('missing');},readGitCommit:()=>{throw Error('no git');}}),{
    engineVersion:null,appVersion:null,gitCommit:null
  });
});
