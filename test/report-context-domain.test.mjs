import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const domain=readFileSync(new URL('../src/domain/reports/report-context.js',import.meta.url),'utf8');
const bridge=readFileSync(new URL('../src/core/report-context.js',import.meta.url),'utf8');

test('künye kuralları domain modülünde saf kalır ve eski global API aynı nesneyi sunar',()=>{
 const ctx=vm.createContext({});
 vm.runInContext(domain,ctx);
 const api=ctx.DG_REPORT_CONTEXT_DOMAIN;
 assert.ok(api);
 vm.runInContext(bridge,ctx);
 assert.equal(ctx.DG_REPORT_CONTEXT,api);
 const valid=api.validate({author_name:'Araştırmacı',project_name:'Park envanteri',title:'Ağaç karbonu',purpose:'Parktaki ağaçların envanteri ve karbon stokunun belirlenmesi.'});
 assert.equal(valid.valid,true);
 assert.equal(api.normalizeOrcid('https://orcid.org/0000-0002-1825-0097'),'0000-0002-1825-0097');
 assert.equal(api.orcidValid('0000-0002-1825-0098'),false);
 assert.equal(api.decode(JSON.stringify({schema:'dendrogeo-report-context/1',study:valid.value,publication_consent:true})).project_name,'Park envanteri');
});

test('compatibility bridge açıkça başarısız olur, domain atlanırsa sessiz API boşluğu bırakmaz',()=>{
 const ctx=vm.createContext({});
 assert.throws(()=>vm.runInContext(bridge,ctx),/domain modülü yüklenmedi/);
});
