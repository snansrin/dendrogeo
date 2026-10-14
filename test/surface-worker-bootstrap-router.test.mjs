import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('surface worker router changes only the surface analysis worker URL',()=>{
 const created=[];class NativeWorker{constructor(url,options){this.url=url;this.options=options;created.push(this);}}
 const window={Worker:NativeWorker};const context=vm.createContext({window,Proxy,Reflect});
 vm.runInContext(read('src/adapters/surface/route-surface-worker-bootstrap.js'),context);
 const bootstrap=new window.Worker('/src/workers/surface-worker.js?build=123',{type:'classic'});
 const other=new window.Worker('/src/workers/other.js');
 assert.equal(bootstrap.url,'/src/workers/surface-worker-bootstrap.js?build=123');
 assert.deepEqual(bootstrap.options,{type:'classic'});
 assert.equal(other.url,'/src/workers/other.js');
});

test('worker bootstrap is cached and loads ring modules before the immutable worker',()=>{
 const source=read('src/workers/surface-worker-bootstrap.js'),sw=read('sw.js'),head=read('partials/head.html');
 assert.ok(source.indexOf("'../domain/parks/osm-rings.js'")<source.indexOf("'./surface-worker.js'"));
 assert.ok(source.indexOf("'../domain/parks/ensure-osm-rings.js'")<source.indexOf("'./surface-worker.js'"));
 assert.ok(sw.includes("'/src/workers/surface-worker-bootstrap.js'"));
 assert.ok(sw.includes("'/src/adapters/surface/route-surface-worker-bootstrap.js'"));
 assert.ok(head.indexOf('src/adapters/surface/route-surface-worker-bootstrap.js')<head.indexOf('src/services/park-geometry.js'));
});
