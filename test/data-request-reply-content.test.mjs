import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const window={};class Clock extends Date{constructor(){super('2026-10-12T12:00:00Z');}}
vm.runInNewContext(readFileSync(new URL('../src/ui/data-request-reply-content.js',import.meta.url),'utf8'),{window,Date:Clock,encodeURIComponent});
const build=window.DG_DATA_REQUEST_REPLY_CONTENT_UI.build;
const summary={count:2,totalCarbon:1500,countries:new Set(['TR']),cities:new Set(['Ankara'])};

test('request reply preserves the full baseline apart from the authorized software citation update',()=>{
 const req={email:'qa@example.test',country:'TR',city:'Ankara',project_name:'Park',note:'Please share',profiles:{full_name:'Ada'}};
 const reply=build(req,summary);
 // Reconstruct the old attribution only; all other wording, values and newlines
 // must still match the pre-extraction baseline.
 assert.match(reply.body,/Version 3\.0\.1/);
 assert.match(reply.body,/10\.5281\/zenodo\.22948773/);
 assert.doesNotMatch(reply.body,/\[Dataset\]/);
 const legacy={...reply,body:reply.body.replace('(Version 3.0.1) [Software]','(Version 3.0.0) [Software] [Dataset]').replaceAll('10.5281/zenodo.22948773','10.5281/zenodo.22646300')};
 assert.equal(createHash('sha256').update(JSON.stringify(legacy)).digest('hex'),'651f4c350bfe74f67eea03ae29b35e8b4d9fe55343bf4730b9de40861ce5dcbc');
});

test('request reply preserves missing-filter/name fallbacks, optional note and zero totals',()=>{
 const reply=build({},{count:0,totalCarbon:0,countries:new Set(),cities:new Set()});
 assert.match(reply.body,/Merhaba Değerli Kullanıcımız,/);assert.match(reply.body,/Ülke\s+: Tümü/);assert.match(reply.body,/Proje\/Park: Tümü/);assert.doesNotMatch(reply.body,/Notunuz/);
 assert.equal(decodeURIComponent(reply.subject),'✅ DendroGeo Veri Talebiniz Hazırlandı — 0 kayıt, 0.00 t C');
 assert.match(reply.body,/ŞİRİN, N\. & ŞİRİN, S\. \(2026\)/);assert.match(reply.body,/Version 3\.0\.1/);assert.match(reply.body,/EPSG:4326/);assert.match(reply.body,/CC BY-NC 4\.0/);
});

test('request reply retains special characters without mutating request or rounding input totals',()=>{
 const req={profiles:{full_name:'Ada & İzel'},note:'Line 1\nLine 2 + %'},before=JSON.stringify(req);
 const totals={...summary,totalCarbon:1234.56789};const reply=build(req,totals);
 assert.match(reply.body,/Ada & İzel/);assert.ok(reply.body.includes('Line 1\nLine 2 + %'));assert.match(decodeURIComponent(reply.subject),/1\.23 t C/);
 assert.equal(totals.totalCarbon,1234.56789);assert.equal(JSON.stringify(req),before);
});
