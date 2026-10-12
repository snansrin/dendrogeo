import {test} from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const window={};vm.runInNewContext(readFileSync(new URL('../src/adapters/backup/json-download.js',import.meta.url),'utf8'),{window});
test('backup download preserves indented JSON, MIME, DOM sequence and delayed URL cleanup',()=>{
 const calls=[],backup={app:'DendroGeo',measurements:[{id:1}]};let payload,timer;const anchor={click(){calls.push('click');},remove(){calls.push('remove');}};
 const browser={document:{createElement(tag){assert.equal(tag,'a');calls.push('create');return anchor;},body:{appendChild(a){assert.equal(a,anchor);calls.push('append');}}},Blob:class{constructor(parts,options){payload={parts:Array.from(parts),type:options.type};}},URL:{createObjectURL(){calls.push('url');return 'blob:qa';},revokeObjectURL(url){calls.push(['revoke',url]);}},setTimeout(fn,ms){timer=fn;calls.push(['timeout',ms]);}};
 window.DG_BACKUP_JSON_DOWNLOAD.download(browser,backup,'backup.json');assert.equal(anchor.download,'backup.json');assert.equal(anchor.href,'blob:qa');assert.deepEqual(payload,{parts:[JSON.stringify(backup,null,2)],type:'application/json'});
 assert.deepEqual(calls,['create','url','append','click','remove',['timeout',5000]]);timer();assert.deepEqual(calls.at(-1),['revoke','blob:qa']);
});
test('backup download propagates browser failures before scheduling cleanup',()=>{
 assert.throws(()=>window.DG_BACKUP_JSON_DOWNLOAD.download({document:{createElement(){throw Error('blocked');}}},{},'backup.json'),/blocked/);
});
