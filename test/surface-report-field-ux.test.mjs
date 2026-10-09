import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { acceptedSurfaceToLulc, stripUnavailableSurfaceMap, isAcceptedSurfaceSnapshot } from '../scripts/lib/surface-snapshot.mjs';

const sample={
  schema:'dendrogeo-surface-accepted/1',revision:7,accepted_at:'2026-10-03T18:00:00.000Z',
  source_fingerprint:'abc',object_fingerprint:'def',
  areas_m2:{green:300000,hard:60000,building:20000,water:120000,pool:4000,bare:6000,other:0},
};
assert.equal(isAcceptedSurfaceSnapshot(sample),true);
const L=acceptedSurfaceToLulc(sample,510000);
assert.ok(L);
assert.equal(L.accepted,true);
assert.equal(L.revision,7);
assert.equal(L.classes.find(x=>x.key==='building').ha,2);
assert.equal(L.classes.find(x=>x.key==='pool').ha,0.4);
assert.equal(L.classes.find(x=>x.key==='hard').ha,6);
assert.ok(Math.abs(L.classes.reduce((a,x)=>a+x.pct,0)-100)<0.1,'sınıf yüzdeleri yaklaşık %100 olmalı');
assert.equal(L.coverage_m2,510000);

const html='<meta property="og:image" content="x"><meta name="twitter:card" content="summary_large_image"><h2><span class="no">6</span>Harita</h2><div><img src="harita.png"></div><h2><span class="no">7</span>Kalite Kontrol ve Doğrulama</h2><a class="btn g" href="harita.png">🛰 Arazi örtüsü haritası (PNG)</a>';
const stripped=stripUnavailableSurfaceMap(html);
assert.ok(!stripped.includes('og:image'));
assert.ok(!stripped.includes('href="harita.png"'));
assert.ok(stripped.includes('son kabul edilmiş yüzey alanlarını'));

const review=readFileSync(new URL('../src/services/lc-review.js',import.meta.url),'utf8');
const reviewContract=readFileSync(new URL('../src/contracts/surface-review.js',import.meta.url),'utf8');
assert.match(reviewContract,/building:Object\.freeze\(\{group:"building",label:"Bina"\}\)/);
assert.match(reviewContract,/pool:Object\.freeze\(\{group:"pool",label:"Havuz \/ süs havuzu"\}\)/);
assert.match(reviewContract,/hard:Object\.freeze\(\{group:"hard",label:"Sert zemin"\}\)/);

const field=readFileSync(new URL('../src/services/field-ux.js',import.meta.url),'utf8');
assert.doesNotMatch(field,/window\.(startGps|renderWaypointList|dgSensRefreshLayer)\s*=/,'compatibility loader must not replace native field behavior');
const sens=readFileSync(new URL('../src/ui/lc-sens.js',import.meta.url),'utf8');
assert.match(sens,/typeof DG_PARK!=="undefined"/);
assert.match(sens,/map\.invalidateSize/);
const map=readFileSync(new URL('../src/services/map.js',import.meta.url),'utf8');
assert.match(map,/DG_WP_PAGE_SIZE=8/);
const measure=readFileSync(new URL('../src/services/measure.js',import.meta.url),'utf8');
assert.match(measure,/12000/);
assert.match(review,/t\.building/);

const migration=readFileSync(new URL('../supabase/migrations/20261003203000_report_accepted_surface_snapshot.sql',import.meta.url),'utf8');
assert.match(migration,/surface_snapshot jsonb/);
assert.match(migration,/payload -> 'acceptedAreas'/);
assert.match(migration,/'building'/);
assert.match(migration,/'pool'/);
assert.match(migration,/new\.with_lulc := false/,'kabul snapshotı varken yeniden LULC çalışmamalı');

const queue=readFileSync(new URL('../scripts/publish-queue.mjs',import.meta.url),'utf8');
assert.match(queue,/surface_snapshot/);
assert.match(queue,/applyAcceptedSurfaceSnapshot/);
assert.match(queue,/skipLulc: accepted \|\| \(!geometrySnapshot && req\.with_lulc === false\)/);

console.log('✅ surface-report-field-ux: accepted snapshot + building/pool + 300-WP saha kilitleri geçti');
