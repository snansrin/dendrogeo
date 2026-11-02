import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
function setup(){
 const ids=[],downloads=[],previews=[],serialized=[],status={textContent:'',style:{}},select={value:'park:7'};
 let projects=[{id:10,park_id:7,park_name:'Park A'},{id:11,park_id:7,park_name:'Park A'},{id:12,park_id:8,park_name:'Park B'}];
 const document={readyState:'loading',addEventListener(){},querySelectorAll(){return[];},getElementById(id){return id==='dgMeasurementExportPark'?select:status;}};
 const window={document,DG_SHARED_PARK_INVENTORY_STORE:{listParticipantProjects:async()=>projects,isCurrentParticipant:async()=>true,readAll:async(client,selected)=>{ids.push(...selected);return selected.map(project_id=>({project_id}));}},dgUserExportPorts:()=>({resolve:format=>({fileName:format+'.csv',previewTitle:format,isCSV:true}),serialize:(format,rows,options)=>{serialized.push({format,rows,options});return 'content';},download:(...args)=>downloads.push(args)}),openPreview:(...args)=>previews.push(args)};
 const context=vm.createContext({window,USER:{id:'user'},PROFILE:{role:'user'},sb:{},document,URL,Blob,console});
 for(const path of ['src/domain/export/shared-park-inventory-domain.js','src/ui/shared-park-inventory-export.js'])vm.runInContext(readFileSync(path,'utf8'),context);
 return {api:window.DG_SHARED_PARK_INVENTORY_EXPORT,ids,downloads,previews,serialized,status,select,revoke(){projects=[];}};
}
test('all three formats and previews read only authorized projects in the selected park',async()=>{
 for(const format of ['csv','geojson','qgis'])for(const preview of [false,true]){
  const app=setup();await app.api.measurementExport(format,preview);
  assert.deepEqual(app.ids,[10,11]);assert.equal(app.serialized[0].format,format);
  assert.equal(app.serialized[0].options.preview,preview);
  assert.equal(app.downloads.length,preview?0:1);assert.equal(app.previews.length,preview?1:0);
 }
});
test('revoked park or empty selection cannot export measurements',async()=>{
 const app=setup();app.revoke();await app.api.measurementExport('csv');assert.deepEqual(app.ids,[]);assert.equal(app.downloads.length,0);
 app.select.value='';await app.api.measurementExport('geojson');assert.deepEqual(app.ids,[]);
});
