import {test} from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const w={};vm.runInNewContext(readFileSync('src/domain/surface/build-sentinel-profile-bbox.js','utf8'),{window:w});const build=w.DG_BUILD_SENTINEL_PROFILE_BBOX.build;
test('Sentinel window handles a million cells without argument overflow or downsampling',()=>{
 const cells=Array.from({length:1000000},(_,i)=>({center:{lat:51+i%1000/10000,lon:-.4+Math.floor(i/1000)/10000}}));
 const box=build(cells);assert.equal(box.minLat,51-.0002);assert.equal(box.maxLat,51.0999+.0002);assert.equal(box.minLon,-.4-.0003);assert.equal(box.maxLon,(-.4+.0999)+.0003);assert.equal(cells.length,1000000);
});
test('streamed Sentinel bounds equal prior extrema and padding for ordinary and empty input',()=>{
 for(const cells of [[],[{center:{lat:0,lon:-0}}],[{center:{lat:-51.5,lon:179.8}},{center:{lat:70,lon:-179.9}},{center:{lat:2.34,lon:20.3}}]]){
  const lat=cells.map(c=>c.center.lat),lon=cells.map(c=>c.center.lon),expected={minLat:Math.min(...lat)-.0002,maxLat:Math.max(...lat)+.0002,minLon:Math.min(...lon)-.0003,maxLon:Math.max(...lon)+.0003};assert.deepEqual(JSON.parse(JSON.stringify(build(cells))),JSON.parse(JSON.stringify(expected)));
 }
});
