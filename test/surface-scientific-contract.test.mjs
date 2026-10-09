import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const load=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const contract=JSON.parse(load('docs/surface-scientific-contract.json'));
const config=load('src/services/lc-config.js');
const validate=load('src/services/lc-validate.js');
const spectral=load('src/services/lc-s2.js');
const review=load('src/ui/lc-sens.js');
const engine=load('src/services/landcover.js');
const application=load('src/application/surface/run-analysis.js');
const quality=load('src/domain/surface/quality-gates.js');
const backup=load('src/services/osm-water-backup.js');
const lazy=load('src/utils/lazylibs.js');
const head=load('partials/head.html');
const qa=load('.github/workflows/gis-three-park-qa.yml');

function literal(source,name){
 // Object constants may contain prose comments with semicolons. Stop at the
 // real closing "};", not at a semicolon inside a documentation comment.
 const match=source.match(new RegExp('const\\s+'+name+'\\s*=\\s*'));
 assert.ok(match,'Source constant not found: '+name);
 const remainder=source.slice(match.index+match[0].length);
 let end;
 if(remainder[0]==='{')end=remainder.indexOf('};');
 else if(remainder[0]==='[')end=remainder.indexOf('];');
 else end=remainder.indexOf(';');
 assert.ok(end>0,'Malformed frozen constant: '+name);
 const value=vm.runInNewContext('('+remainder.slice(0,end+(remainder[0]==='{'||remainder[0]==='['?1:0))+')',{},{timeout:1000});
 return JSON.parse(JSON.stringify(value));
}
test('approved surface contract references verified release and clear provenance limits',()=>{
 assert.equal(contract.verified_release_commit,'7680cab4a7fd9102bef64e5cf031b740940a5be0');
 assert.equal(contract.recovery_branch,'recovery/surface-verified-water-20261008');
 assert.equal(contract.schema,'dendrogeo/surface-scientific-contract/v1');
 assert.ok(contract.reproducibility.data_not_fully_embedded_in_accepted_result.length>=4);
 assert.match(contract.reproducibility.warning,/may change/);
});
test('WorldCover v200 2021 input, class mapping and 10 m fractional area remain pinned',()=>{
 assert.equal(literal(config,'DG_LC_ENGINE_VERSION'),contract.engine_version);
 const src=literal(config,'DG_LC_SOURCES');
 assert.equal(src.primary.collection,contract.baseline.collection);
 assert.equal(src.primary.year,contract.baseline.year);
 assert.match(src.primary.label,/v200/);
 assert.equal(literal(config,'DG_LC_PIXEL_M'),contract.baseline.spatial_resolution_m);
 const mapping=literal(config,'DG_ESA_GROUP');
 for(const [group,codes] of Object.entries(contract.baseline.mapping))
  for(const code of codes)assert.equal(mapping[code],group);
 assert.match(application,/assertCoverage\(result\.assignedAreaM2,parkAreaM2,0\.5\)/);
 assert.match(quality,/deltaPct>maxMismatchPercent/);
 assert.equal(contract.baseline.max_park_raster_area_mismatch_percent,0.5);
 assert.match(application,/waterRefined=0,roadRefined=0/);
});
test('Sentinel input composition and scan windows have not drifted',()=>{
 const s=contract.spectral;
 assert.equal(literal(spectral,'DG_S2_MAX_SCENES'),s.max_scene_count);
 assert.equal(literal(spectral,'DG_S2_MAX_CLOUD'),s.max_scene_cloud_percent);
 assert.deepEqual(literal(spectral,'DG_S2_BANDS'),s.bands);
 assert.deepEqual(literal(spectral,'DG_S2_SCL_VALID'),s.accepted_scl);
 assert.equal(literal(validate,'DG_VAL_SPECTRAL').MIN_OBS,s.min_distinct_clear_observations_per_cell);
 assert.match(spectral,/currentYear,0,1/);
 assert.match(spectral,/120\*86400000/);
 assert.match(spectral,/06-01T00:00:00Z/);
 assert.match(spectral,/09-30T23:59:59Z/);
 for(const [start,end,max] of [['02-01','05-31',3],['10-01','12-15',2]]){
  assert.match(spectral,new RegExp(start+'T00:00:00Z'));
  assert.match(spectral,new RegExp(end+'T23:59:59Z'));
  assert.match(spectral,new RegExp('max:'+max));
 }
 assert.match(spectral,/DG_S2_COLLECTION="sentinel-2-l2a"/);
 assert.match(config,/planetarycomputer\.microsoft\.com\/api\/stac\/v1/);
});
test('spectral thresholds and sensitivity bar slopes match recorded analysis conditions',()=>{
 const obj=literal(validate,'DG_VAL_SPECTRAL');
 const m=contract.spectral;
 for(const [prop,v] of Object.entries({
  MNDWI_WATER_MIN:m.water_thresholds.mndwi_median_min,
  MNDWI_MAX_WATER:m.water_thresholds.mndwi_season_max_min,
  NDVI_WATERCANOPY_MAX:m.water_thresholds.ndvi_canopy_max,
  NDVI_GREEN_MIN:m.green_thresholds.ndvi_min,
  NDVI_MAX_GREEN:m.green_thresholds.ndvi_year_max_min,
  IBI_HARD_MIN:m.hard_thresholds.ibi_min,
  NDVI_HARD_MIN:m.hard_thresholds.ndvi_min,
  NDVI_BARE_MAX:m.bare_thresholds.ndvi_max
 })) assert.equal(obj[prop],v,prop);
 assert.deepEqual(literal(validate,'DG_VAL_SENS_K'),m.slider_coefficients);
 assert.match(review,/sens:\{green:50,water:50,hard:50,bare:50\}/);
 assert.match(review,/function dgSensResetScanState\(rec\).*rec\.sens=\{green:50,water:50,hard:50,bare:50\}/);
});
test('water identity, automatic first analysis, failure behavior and uncertainty guard',()=>{
 assert.match(backup,/WAY_ID=423602740/);
 assert.equal(contract.water.verified_goksu_water_object,'way/423602740');
 assert.equal(contract.water.verified_goksu_park_object,'way/423602737');
 assert.match(review,/dgSensAutoWaterOnMount\(rec,epoch\)/);
 assert.match(review,/function dgSensHasVerifiedWaterBoundary/);
 assert.match(review,/dgSensWaterBoundaryUnresolved\(\)>0/);
 assert.match(review,/if\(original==="water"&&dgSensHasWaterFootprint\(\)\)/);
 assert.match(qa,/node scripts\/verify-osm-water-live\.mjs/);
});
test('verified loader, accepted snapshot and no forced changes to published reports',()=>{
 assert.ok(head.indexOf('osm-water-backup.js')>=0);
 assert.ok(head.indexOf('<script src="src/services/osm-water-backup.js')<
   head.indexOf('<script src="src/utils/lazylibs.js'));
 assert.match(lazy,/vendor\/polygon-clipping-0\.15\.7\.js/);
 assert.match(review,/schema:"dendrogeo-surface\/2"/);
 assert.match(review,/scenes:rec\.profile\?\.scenes\|\|\[\]/);
 assert.match(review,/displayMethod:\{name:"exact-geometry",version:4,tolerance_m:0\}/);
 assert.match(review,/rec\.acceptedResult/);
});
