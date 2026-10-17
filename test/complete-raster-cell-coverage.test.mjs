import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {loadApp} from '../scripts/test-harness.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('every classified raster cell survives a park exceeding 10000 cells',async()=>{
 const ctx=loadApp({sadece:['src/config/constants.js','src/services/lc-config.js','src/domain/surface/classify-landcover-code.js','src/services/lc-geo.js','src/services/lc-stac.js','src/domain/surface/merge-tile-results.js','src/adapters/surface/result-exports.js','src/application/surface/analyze-source.js']});
 const width=101,height=101,values=new Uint16Array(width*height).fill(10);
 const image={getGeoKeys:()=>({}),getBoundingBox:()=>[32.58,39.97,32.59,39.98],getWidth:()=>width,getHeight:()=>height,readRasters:async()=>values};
 ctx.dgLcOpenRaster=async()=>({getImage:async()=>image});vm.runInContext(read('src/adapters/surface/process-landcover-tile.js'),ctx);vm.runInContext(read('src/services/lc-engine.js'),ctx);
 ctx.geometry={outer:[[[39.97,32.58],[39.97,32.59],[39.98,32.59],[39.98,32.58],[39.97,32.58]]],holes:[]};
 const result=await vm.runInContext('dgLcProcessTile({id:"large-park",properties:{}},"fixture.tif",geometry,DG_LC_SOURCES.primary)',ctx);
 assert.equal(result.sourceCells,width*height);assert.equal(result.cells.length,width*height);assert.equal(result.groupCounts.green,result.cells.length);
 assert.ok(result.cells.some(cell=>cell.row===100&&cell.col===100),'southern edge and last raster row must remain editable');
 const sum=result.cells.reduce((total,cell)=>total+cell.areaM2,0);assert.ok(Math.abs(sum-result.classifiedAreaM2)<1e-5,'editable-cell area must equal classified area');
});

test('mosaics retain later tiles after the first tile exceeds 10000 cells',()=>{
 const window={};vm.runInNewContext(read('src/domain/surface/merge-tile-results.js'),{window});
 const make=(prefix,count)=>({assignedAreaM2:count*100,classifiedAreaM2:count*100,maskedAreaM2:0,sourceCells:count,groupCounts:{green:count},groupAreas:{green:count*100},rawCounts:{10:count},rawAreas:{10:count*100},cells:Array.from({length:count},(_,i)=>({id:prefix+i,areaM2:100})),runs:[]});
 const first=make('north-',10001),second=make('south-',500),result=window.DG_SURFACE_TILE_MERGER.merge([first,second]);
 assert.equal(result.cells.length,10501);assert.equal(result.cells.at(-1).id,'south-499');assert.equal(result.groupCounts.green,result.cells.length);assert.equal(result.cells.reduce((sum,c)=>sum+c.areaM2,0),result.assignedAreaM2);
});
