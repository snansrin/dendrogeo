import {test} from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const window={};vm.runInNewContext(readFileSync(new URL('../src/domain/backup/build-snapshot.js',import.meta.url),'utf8'),{window});
test('backup snapshot preserves schema, DOI, property order, counts and original row identity',()=>{
 const input={measurements:[{id:1,owner:'qa',carbon_kg:418.419108}],projects:[{id:7}],waypoints:[],requests:[{id:8}]},before=JSON.stringify(input),snapshot=window.DG_BACKUP_SNAPSHOT.build(input,{exportedAt:'2026-10-12T12:00:00.000Z',exportedBy:'Ada'});
 assert.deepEqual(JSON.parse(JSON.stringify(snapshot)),{app:'DendroGeo',schema_version:'1.1.0',doi:'10.5281/zenodo.22948773',exported_at:'2026-10-12T12:00:00.000Z',exported_by:'Ada',scope:{access:'current-session-rls',complete_system_backup:false,excluded:['auth','storage-file-bytes','local-validation-campaigns','offline-queue','database-schema-and-policies','publication-archives']},counts:{measurements:1,projects:1,waypoints:0,data_requests:1,parks:0,surface_reviews:0},parks:[],surface_reviews:[],measurements:input.measurements,projects:input.projects,waypoints:[],data_requests:input.requests});
 assert.equal(snapshot.measurements,input.measurements);assert.equal(snapshot.data_requests,input.requests);assert.equal(JSON.stringify(input),before);
 assert.deepEqual(Object.keys(snapshot),['app','schema_version','doi','exported_at','exported_by','scope','counts','parks','projects','measurements','waypoints','data_requests','surface_reviews']);
});
