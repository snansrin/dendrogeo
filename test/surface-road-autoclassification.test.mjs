import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/domain/surface/osm-road-policy.js',import.meta.url),'utf8');
function policy(){const context=vm.createContext({window:{}});vm.runInContext(source,context);return context.window.DG_OSM_ROAD_POLICY;}

test('OSM measured and estimated widths take precedence over transparent highway-class estimates',()=>{
 const roads=policy();
 assert.deepEqual({...roads.width({highway:'footway',width:'8 m'})},{metres:8,source:'osm-width'});
 assert.deepEqual({...roads.width({highway:'footway','width:carriageway':'6.5'})},{metres:6.5,source:'osm-width'});
 assert.deepEqual({...roads.width({highway:'path',est_width:'5'})},{metres:5,source:'osm-estimated-width'});
 assert.deepEqual({...roads.width({highway:'footway',lanes:'2'})},{metres:6,source:'lane-count-estimate'});
 assert.deepEqual({...roads.width({highway:'footway',surface:'paving_stones'})},{metres:5,source:'highway-class-estimate'});
 assert.equal(roads.halfWidth({highway:'footway',surface:'paving_stones'}),2.5);
});

test('only explicitly hard-paved walking and cycling ways enter surface refinement',()=>{
 const roads=policy();
 for(const highway of ['footway','path','cycleway','pedestrian','steps','bridleway','track'])assert.equal(roads.shouldRefine({highway,surface:'paving_stones'}),true,highway);
 for(const highway of ['footway','path','cycleway','pedestrian'])assert.equal(roads.shouldRefine({highway,surface:'ground'}),false,highway);
 assert.equal(roads.shouldRefine({highway:'footway'}),false);
 assert.equal(roads.shouldRefine({highway:'residential',surface:'asphalt'}),true);
});

test('OSM way geometry carries its width provenance and closed polygon footprint',()=>{
 const roads=policy(),line={type:'way',id:1,tags:{highway:'footway',surface:'asphalt'},geometry:[{lat:39,lon:32},{lat:39.1,lon:32.1}]},area={type:'way',id:2,tags:{highway:'pedestrian',surface:'paved'},geometry:[{lat:39,lon:32},{lat:39,lon:32.1},{lat:39.1,lon:32.1},{lat:39,lon:32}]};
 const result=roads.build({elements:[line,area]},roads.shouldRefine,roads.halfWidth);
 assert.equal(result.length,2);assert.equal(result[0].halfWidth,2.5);assert.equal(result[0].widthM,5);assert.equal(result[0].widthSource,'highway-class-estimate');assert.equal(result[0].area,false);assert.equal(result[1].area,true);
});
