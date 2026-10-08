import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {presentationSurfaceClasses,reviewedSurface} from '../scripts/surface-report.mjs';
import {renderReport} from '../scripts/make-report.mjs';
import {canonicalHash} from '../scripts/lib/mc.mjs';

const root=new URL('../',import.meta.url);
const load=p=>readFileSync(new URL(p,root),'utf8');

test('water/pool display merges by area and percent without changing scientific classes',()=>{
 const raw=[
  {key:'green',label:'Yeşil alan',ha:28,pct:56},
  {key:'water',label:'Su',ha:12,pct:24},
  {key:'pool',label:'Havuz / süs havuzu',ha:.5,pct:1},
  {key:'hard',label:'Sert zemin',ha:9.5,pct:19}
 ];
 const original=structuredClone(raw);
 const shown=presentationSurfaceClasses(raw);
 assert.equal(shown.length,3);
 assert.equal(shown.find(x=>x.key==='pool'),undefined);
 assert.equal(shown.find(x=>x.key==='water').ha,12.5);
 assert.equal(shown.find(x=>x.key==='water').pct,25);
 assert.equal(shown.reduce((sum,x)=>sum+x.ha,0),50);
 assert.equal(shown.reduce((sum,x)=>sum+x.pct,0),100);
 assert.deepEqual(raw,original,'immutable raw evidence cannot be rewritten for a display preference');
});

test('pool-only saved area still generates a Su row with no missing area',()=>{
 const shown=presentationSurfaceClasses([
  {key:'pool',label:'Havuz / süs havuzu',ha:0.2,pct:2},
  {key:'green',label:'Yeşil alan',ha:9.8,pct:98}
 ]);
 assert.equal(shown.find(x=>x.key==='water').label,'Su');
 assert.equal(shown.find(x=>x.key==='water').ha,.2);
 assert.equal(shown.reduce((sum,x)=>sum+x.ha,0),10);
});

test('new academic HTML report renders one Su line, with a correct combined area and no pool narrative',()=>{
 const snapshot=JSON.parse(load('test/fixtures/report-snapshot.json'));
 const original={...snapshot};
 snapshot.lulc={...(snapshot.lulc||{}),
  source:'Kullanıcının kabul ettiği son analiz · uydu / OSM / çizim',
  review:{acceptedAt:'2026-10-08T10:00:00Z',scenes:[]},
  classes:[
   {key:'green',label:'Yeşil alan',ha:28,pct:56},
   {key:'water',label:'Su',ha:12,pct:24},
   {key:'pool',label:'Havuz / süs havuzu',ha:.5,pct:1},
   {key:'hard',label:'Sert zemin',ha:9.5,pct:19}
  ],
  cells:5000,coverage_m2:500000,classified_m2:500000,masked_ha:0,epsg:32636
 };
 const source=structuredClone(snapshot.lulc.classes);
 const html=renderReport(snapshot,{id:'DGR-2026-0024',hash:canonicalHash(snapshot),version:1});
 const table=html.match(/<table class="summary"><caption>Çizelge 2\.[\s\S]*?<\/table>/)?.[0]||'';
 assert.ok(table,'report must have its landcover results table');
 assert.equal((table.match(/<td class="tr">Su<\/td>/g)||[]).length,1);
 assert.doesNotMatch(table,/Havuz|süs havuzu/i);
 assert.match(table,/12,50/,'12.00 ha water + 0.50 ha legacy pool must display 12.50 ha');
 assert.match(table,/%25,0/,'combined surface share is 25.0 percent');
 assert.doesNotMatch(html.slice(0,html.indexOf('<script id="dg-report-data"')>0?html.indexOf('<script id="dg-report-data"'):html.length),/Bina ve havuzlar ayrı sınıftır|OpenStreetMap bina, su, havuz/);
 assert.deepEqual(snapshot.lulc.classes,source,'render must not mutate saved evidence');
});

test('report render retains source classes and the public report archive remains untouched',()=>{
 const report=load('scripts/make-report.mjs');
 const lock=JSON.parse(load('docs/surface-engine-lock.json'));
 assert.ok(!lock.locked_files['scripts/make-report.mjs']);
 assert.ok(!lock.locked_files['scripts/surface-report.mjs']);
 assert.match(report,/visibleSurfaceClasses\.map/);
 assert.match(report,/presentationSurfaceClasses\(L\?\.classes\)/);
 assert.doesNotMatch(report,/\['pool','havuz \/ süs havuzu'\]/);
 assert.match(load('scripts/surface-report.mjs'),/export function reviewedSurface/);
});
