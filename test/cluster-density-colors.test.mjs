import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
test('density colors stay green below ten, amber for 35/46, and red from fifty',()=>{
 const window={};vm.runInNewContext(readFileSync(new URL('../src/domain/map/measurement-marker-cluster-icon.js',import.meta.url),'utf8'),{window});
 const icon=count=>window.DG_MEASUREMENT_MARKER_CLUSTER_ICON.create(count,{divIcon:options=>options});
 for(const count of [1,9])assert.equal(icon(count).className,'marker-cluster marker-cluster-small');
 for(const count of [10,35,46,49])assert.equal(icon(count).className,'marker-cluster marker-cluster-medium');
 for(const count of [50,100])assert.equal(icon(count).className,'marker-cluster marker-cluster-large');
});
