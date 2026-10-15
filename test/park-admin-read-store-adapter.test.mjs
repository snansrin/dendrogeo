import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('park admin adapter preserves all three existing read shapes and result identity',async()=>{
  const window={},context=vm.createContext({window}),calls=[],responses=new Map([
    ['parks',{data:[{id:1,name:'Park'}],error:null}],
    ['projects',{data:[{id:2,park_id:1}],error:null}],
    ['measurements',{data:[{park_id:1}],error:null}]
  ]);
  vm.runInContext(read('src/adapters/parks/park-admin-read-store.js'),context);
  const client={from(table){calls.push(['from',table]);const query={select(columns){calls.push(['select',columns]);return query;},order(...args){calls.push(['order',...args]);return query;},limit(...args){calls.push(['limit',...args]);return query;},then(resolve,reject){return Promise.resolve(responses.get(table)).then(resolve,reject);}};return query;}};
  const store=window.DG_PARK_ADMIN_READ_STORE;
  for(const [method,table] of [['fetchParks','parks'],['fetchProjects','projects'],['fetchMeasurements','measurements']])assert.equal(await store[method](client),responses.get(table));
  assert.deepEqual(JSON.parse(JSON.stringify(calls)),[
    ['from','parks'],['select','*,creator:profiles!parks_created_by_fkey(full_name)'],['order','name'],
    ['from','projects'],['select','id,name,park_id'],
    ['from','measurements'],['select','park_id'],['limit',5000]
  ]);
});

test('park admin facade delegates reads and adapter loads before it into the offline shell',()=>{
  const path='src/adapters/parks/park-admin-read-store.js',head=read('partials/head.html'),sw=read('sw.js'),service=read('src/services/park-registry.js');
  assert.ok(head.indexOf(path)<head.indexOf('src/services/park-registry.js'));
  assert.ok(sw.includes(`'/${path}'`));
  for(const method of ['fetchParks','fetchProjects','fetchMeasurements'])assert.match(service,new RegExp(`DG_PARK_ADMIN_READ_STORE\\.${method}\\(sb\\)`));
});

test('park project adapter preserves coordinate limits and the backfill projection',async()=>{
  const context=vm.createContext({window:{}}),calls=[];
  vm.runInContext(read('src/adapters/parks/park-project-read-store.js'),context);
  const client={from(table){calls.push(['from',table]);const query={select(columns){calls.push(['select',columns]);return query;},eq(...args){calls.push(['eq',...args]);return query;},limit(...args){calls.push(['limit',...args]);return Promise.resolve({data:[],error:null});}};return query;}};
  const store=context.window.DG_PARK_PROJECT_READ_STORE;
  await store.fetchMeasurements({client,projectId:12,limit:500});
  await store.fetchMeasurements({client,projectId:13,limit:1000});
  await store.fetchBackfillProjects(client);
  assert.deepEqual(JSON.parse(JSON.stringify(calls)),[
    ['from','measurements'],['select','lat,lon'],['eq','project_id',12],['limit',500],
    ['from','measurements'],['select','lat,lon'],['eq','project_id',13],['limit',1000],
    ['from','projects'],['select','id,name,owner,park_id,park_name,label,city,country']
  ]);
  const head=read('partials/head.html'),sw=read('sw.js'),service=read('src/services/park-registry.js'),controller=read('src/bootstrap/park-backfill-controller.js'),path='src/adapters/parks/park-project-read-store.js';
  assert.ok(head.indexOf(path)<head.indexOf('src/services/park-registry.js'));assert.ok(sw.includes(`'/${path}'`));
  assert.match(service,/DG_PARK_PROJECT_READ_STORE\.fetchMeasurements/);assert.match(controller,/DG_PARK_PROJECT_READ_STORE\.fetchBackfillProjects/);
});
