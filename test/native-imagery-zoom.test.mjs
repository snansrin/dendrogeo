import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('basemap resolution and zoom policy match the working 14 October version',()=>{
 for(const [path,digest] of Object.entries({"src/domain/map/resolve-base-map-layer.js":"4b9498394fb62cdd1ab71ea5e461b1d85b5a5c77e5d5afcd281c430e522cc92f"}))assert.equal(createHash('sha256').update(read(path)).digest('hex'),digest,'14 October reference 7d0ad29: '+path);
 const window={};vm.runInNewContext(read('src/domain/map/resolve-base-map-layer.js'),{window});
 for(const [type,native] of [['osm',19],['sat',19],['topo',17]]){const configuration=window.DG_RESOLVE_BASE_MAP_LAYER.resolve(type,{});assert.equal(configuration.maxNativeZoom,native);assert.equal(configuration.maxZoom,22);assert.ok(!configuration.url.includes('blankTile'));}
});
