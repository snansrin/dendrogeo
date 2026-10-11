import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/ui/gis-export-download.js',import.meta.url),'utf8');

function load({blob={size:123}}={}){
 const events=[],timers=[];
 let link;
 const context=vm.createContext({window:{},URL:{createObjectURL:value=>{events.push(['create',value]);return 'blob:gis';},revokeObjectURL:value=>events.push(['revoke',value])},
  document:{body:{append:value=>events.push(['append',value])},createElement:tag=>{assert.equal(tag,'a');link={click:()=>events.push(['click']),remove:()=>events.push(['remove']),set href(value){this.url=value;},set download(value){this.filename=value;}};return link;}},
  setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length;}});
 vm.runInContext(source,context);
 const canvas={toBlob(callback,type){events.push(['toBlob',type]);callback(blob);}};
 return{save:context.window.DG_GIS_EXPORT_DOWNLOAD.save,canvas,events,timers,blob,get link(){return link;}};
}

test('GIS PNG download creates a link, saves the requested file, and revokes its URL',async()=>{
 const f=load();
 let downloaded=null;
 const result=await f.save({canvas:f.canvas,filename:'park.png',onDownloaded:value=>{downloaded=value;}});
 assert.equal(result,true);
 assert.equal(downloaded,f.blob);
 assert.equal(f.link.url,'blob:gis');
 assert.equal(f.link.filename,'park.png');
 assert.deepEqual(f.events.map(x=>x[0]),['toBlob','create','append','click','remove']);
 assert.equal(f.timers[0].ms,2000);
 f.timers[0].fn();
 assert.deepEqual(f.events.at(-1),['revoke','blob:gis']);
});

test('a missing PNG blob reports failure and does not create a download link',async()=>{
 const f=load({blob:null});let unavailable=0,downloaded=0;
 const result=await f.save({canvas:f.canvas,filename:'park.png',onUnavailable:()=>unavailable++,onDownloaded:()=>downloaded++});
 assert.equal(result,false);
 assert.equal(unavailable,1);
 assert.equal(downloaded,0);
 assert.deepEqual(f.events,[['toBlob','image/png']]);
 assert.equal(f.timers.length,0);
});

test('download module loads before GIS adapter and is precached',()=>{
 const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 assert.ok(index.indexOf('src/ui/gis-export-download.js')<index.indexOf('src/ui/gis-export.js'));
 assert.match(index,/src\/ui\/gis-export-download\.js\?v=[a-f0-9]{8}/);
 assert.match(sw,/\/src\/ui\/gis-export-download\.js/);
});
