import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createReportCli} from '../scripts/lib/report-cli.mjs';

function fixture(options={}) {
  const calls=[];
  const main=createReportCli({
    arg:name=>options[name],has:name=>!!options[name],
    rebuildIndex:()=>{calls.push('index');return [];},
    readFileSync:(path,encoding)=>{calls.push(['read',path,encoding]);return 'context';},
    decodeReportContext:()=>options.invalid?null:{title:'Study'},
    publishPark:async(id,opts)=>{calls.push(['publish',id,opts]);return {path:'report/',supersedes:[]};},
    log:()=>{},error:()=>calls.push('error'),exit:code=>calls.push(['exit',code])
  });
  return {main,calls};
}

test('reindex takes precedence and reads no publication file',async()=>{
  const f=fixture({reindex:true,park:'5'});
  await f.main();
  assert.deepEqual(f.calls,['index']);
});

test('missing park returns usage exit code without reading or publishing',async()=>{
  const f=fixture();
  await f.main();
  assert.deepEqual(f.calls,['error',['exit',2]]);
});

test('missing or undecodable publication context cannot publish',async()=>{
  const missing=fixture({park:'5'});
  await assert.rejects(missing.main(),/--publication-file/);
  assert.deepEqual(missing.calls,[]);
  const invalid=fixture({park:'5','publication-file':'context.json',invalid:true});
  await assert.rejects(invalid.main(),/Geçerli yayın künyesi gerekli/);
  assert.deepEqual(invalid.calls,[['read','context.json','utf8']]);
});

test('CLI forwards the selected park, parsed context and skip option',async()=>{
  const f=fixture({park:'5','publication-file':'context.json','skip-lulc':true});
  await f.main();
  assert.deepEqual(f.calls,[['read','context.json','utf8'],['publish','5',{skipLulc:true,study:{title:'Study'}}]]);
});
