import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const window={};
vm.runInNewContext(readFileSync(new URL('../src/domain/visitors/device-label.js',import.meta.url),'utf8'),{window});
const build=window.DG_VISITOR_DEVICE_LABEL.build;

test('presence device labels preserve overlapping browser and OS precedence',()=>{
 for(const [ua,label] of [
  ['Windows Chrome/100 Safari/537 Edg/100','masaüstü · Windows · Edge'],
  ['Windows Chrome/100 Safari/537 OPR/90','masaüstü · Windows · Opera'],
  ['Windows Chrome/100 Safari/537','masaüstü · Windows · Chrome'],
  ['Linux Firefox/100','masaüstü · Linux · Firefox'],
  ['Mac OS X Safari/605','masaüstü · macOS · Safari'],
  ['Linux Android Chrome/100 Mobile Safari/537','mobil · Android · Chrome'],
  ['iPhone CPU iPhone OS like Mac OS X Mobile Safari/605','mobil · iOS · Safari'],
  ['iPad CPU OS like Mac OS X Safari/605','mobil · iOS · Safari'],
  ['iPod Safari/605','mobil · iOS · Safari']
 ])assert.equal(build(ua),label,ua);
});

test('presence device labels keep unknown and absent-user-agent fallbacks',()=>{
 for(const ua of ['',null,undefined,'Unrecognized'])assert.equal(build(ua),'masaüstü · ? · ?');
 assert.equal(build('Mobi'),'mobil · ? · ?');
 assert.equal(build('Edg Chrome/100'),'masaüstü · ? · Chrome');
 assert.equal(build('Windows Android Linux Firefox/100'),'mobil · Windows · Firefox');
});

test('service preserves navigator-error fallback and delegates valid device labels',()=>{
 const source=readFileSync(new URL('../src/services/visit-stats.js',import.meta.url),'utf8');
 const declaration=source.slice(source.indexOf('const DG_DEV_TAG='),source.indexOf('const DG_ACT_LABELS='));
 const run=navigator=>vm.runInNewContext(declaration+'DG_DEV_TAG',{window,navigator});
 assert.equal(run({userAgent:'Windows Edg/100'}),'masaüstü · Windows · Edge');
 assert.equal(run({get userAgent(){throw Error('blocked');}}),'?');
 assert.equal(vm.runInNewContext(declaration+'DG_DEV_TAG',{window}),'?');
});
