import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {gitBlobSha,verifySurfaceFiles,verifySurfaceLock,PINNED_MANIFEST_BLOB,APPROVED_COMMIT} from '../scripts/check-surface-lock.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const manifestBytes=readFileSync(join(root,'docs/surface-engine-lock.json'));
const manifest=JSON.parse(manifestBytes.toString('utf8'));

test('yüzey motoru manifesti sabit ve 54 dosya ve tam bağımlılık zinciri korunuyor',()=>{
 assert.equal(gitBlobSha(manifestBytes),PINNED_MANIFEST_BLOB);
 assert.equal(manifest.baseline_commit,APPROVED_COMMIT);
 assert.equal(manifest.policy,'NO_CHANGES_WITHOUT_EXPLICIT_USER_APPROVAL');
 assert.equal(Object.keys(manifest.locked_files).length,54);
 assert.deepEqual(verifySurfaceLock(root),[]);
});

test('kilit motoru bilinçli bir sınıflandırma dosyası değişikliğini reddeder',()=>{
 const rel='src/services/lc-validate.js',bytes=readFileSync(join(root,rel));
 const temp=mkdtempSync(join(tmpdir(),'dg-surface-lock-'));
 try{
  const dest=join(temp,rel);mkdirSync(dirname(dest),{recursive:true});writeFileSync(dest,bytes);
  assert.deepEqual(verifySurfaceFiles(temp,{[rel]:manifest.locked_files[rel]}),[]);
  writeFileSync(dest,Buffer.concat([bytes,Buffer.from('\n// accidental threshold change\n')]));
  const failures=verifySurfaceFiles(temp,{[rel]:manifest.locked_files[rel]});
  assert.equal(failures.length,1);
  assert.match(failures[0],/KİLİTLİ DOSYA DEĞİŞTİ/);
  rmSync(dest);
  assert.match(verifySurfaceFiles(temp,{[rel]:manifest.locked_files[rel]})[0],/EKSİK/);
 }finally{rmSync(temp,{recursive:true,force:true});}
});

test('barlar, Sentinel, OSM, fırça, geometri ve harita kodu kapsam dışında bırakılamaz',()=>{
 for(const rel of [
  'src/ui/lc-sens.js','src/services/lc-s2.js','src/services/lc-osm.js',
  'src/services/lc-validate.js','src/services/lc-engine.js','src/services/lc-review.js',
  'src/services/park-query.js','src/services/park-geometry.js',
  'src/workers/surface-worker.js','css/style.css','partials/shell.html'
 ])assert.ok(manifest.locked_files[rel],'Kilitte yok: '+rel);
});

test('OSM yedeği, raster parser, poligon ve bilimsel protokol/test zinciri kilitte',()=>{
 const mandatory=[
  'src/services/osm-water-backup.js','vendor/geotiff-2.1.3.js','vendor/polygon-clipping-0.15.7.js',
  'vendor/leaflet-1.9.4.js','test/fixtures/goksu-park.json','scripts/verify-osm-water-live.mjs',
  'scripts/val-qa.mjs','scripts/lulc-qa.mjs','docs/surface-scientific-contract.json',
  'test/surface-scientific-contract.test.mjs','test/verified-water-footprint.test.mjs',
  'test/water-osm-reliability.test.mjs','test/surface-review.test.mjs',
  'test/surface-network-budget.test.mjs','test/landcover-v4.test.mjs',
  'test/lc-validate.test.mjs','test/surface-engine-lock.test.mjs',
  'src/domain/surface/quality-gates.js','src/application/surface/run-analysis.js','test/surface-application.test.mjs',
  '.github/workflows/gis-three-park-qa.yml'
 ];
 for(const path of mandatory)assert.ok(manifest.locked_files[path],'Korunan bağımlılık eksik: '+path);
 assert.equal(manifest.recovery_branch,'recovery/analysis-engine-20261009');
 assert.equal(manifest.baseline_commit,APPROVED_COMMIT);
});

test('PR CI yüzey kilidini testlerden bağımsız çalıştırır',()=>{
 const ci=readFileSync(join(root,'.github/workflows/ci.yml'),'utf8');
 const pkg=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));
 assert.match(ci,/run: node scripts\/check-surface-lock\.mjs/);
 assert.equal(pkg.scripts['check:surface-lock'],'node scripts/check-surface-lock.mjs');
 assert.match(pkg.scripts.check,/check:surface-lock/);
});
