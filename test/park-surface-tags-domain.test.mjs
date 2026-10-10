import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/domain/parks/classify-surface-tags.js',import.meta.url),'utf8');
const context=vm.createContext({window:{}});
vm.runInContext(source,context);
const rules=context.window.DG_PARK_SURFACE_TAGS;
const water=tags=>rules.isWater({tags});
const hard=tags=>rules.isImpervious({tags});

test('water aliases preserve the existing OSM tag rule',()=>{
  for(const tags of [
    {natural:'water'}, {water:'pond'}, {landuse:'reservoir'}, {landuse:'basin'},
    {leisure:'swimming_pool'}, {waterway:'riverbank'}
  ])assert.equal(water(tags),true,JSON.stringify(tags));
  for(const tags of [{natural:'wetland'},{landuse:'grass'},{water:''},{}])assert.equal(water(tags),false,JSON.stringify(tags));
});

test('impervious decisions retain precedence for buildings, roads, surfaces and facilities',()=>{
  for(const tags of [
    {building:'yes',surface:'grass'}, {'building:part':'yes'}, {'area:highway':'pedestrian'},
    {landuse:'highway'}, {surface:'asphalt'}, {surface:'CONCRETE'},
    {amenity:'parking'}, {amenity:'bicycle_parking'}, {amenity:'motorcycle_parking'},
    {leisure:'pitch',surface:'paving_stones'}, {highway:'residential'}
  ])assert.equal(hard(tags),true,JSON.stringify(tags));

  for(const tags of [
    {surface:'gravel'}, {amenity:'parking',surface:'gravel'}, {leisure:'pitch',surface:'grass'},
    {highway:'footway'}, {highway:'track'}, {highway:'residential',surface:'dirt'}, {}
  ])assert.equal(hard(tags),false,JSON.stringify(tags));
});
