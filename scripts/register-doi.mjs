#!/usr/bin/env node
/* Idempotent Zenodo draft upload. --publish registers a real DOI; no token enters Git. */
import {readFileSync,writeFileSync,existsSync,mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {prepareReportDoi} from './prepare-report-doi.mjs';
import {parseZenodoDepositState} from './lib/publication.mjs';
import {buildMetadata} from './make-report.mjs';
import {canonicalHash} from './lib/canonical-hash.mjs';
import {renderReportPdf} from './render-report-pdf.mjs';
const root=fileURLToPath(new URL('..',import.meta.url));
const id=process.argv[2];
if(!/^DGR-\d{4}-\d{4}$/.test(id||''))throw Error('Kullanım: node scripts/register-doi.mjs DGR-YYYY-NNNN [--publish]');
const dir=join(root,'rapor',id),statePath=join(dir,'zenodo-deposit.json'),doiPath=join(dir,'doi.json');
if(existsSync(doiPath)){const d=JSON.parse(readFileSync(doiPath,'utf8'));if(d.report_id!==id||!/^10\.5281\/zenodo\.\d+$/.test(d.doi||''))throw Error('Kayıtlı DOI geçersiz.');const snap=JSON.parse(readFileSync(join(dir,'data.json'),'utf8')),md=JSON.parse(readFileSync(join(dir,'metadata.json'),'utf8'));writeFileSync(join(dir,'metadata.json'),JSON.stringify(buildMetadata(snap,{id,hash:canonicalHash(snap),version:md.version,meta:{...snap.provenance,doi:d.doi},history:(md.history||[]).filter(h=>h.id!==id).map(h=>({...h,retracted:h.status==='Geri çekildi'}))}))+'\n');await renderReportPdf(id,{force:true});console.log('Mevcut DOI belgeye işlendi; ikinci kayıt oluşturulmadı.');process.exit(0);}
const token=process.env.ZENODO_TOKEN;if(!token)throw Error('ZENODO_TOKEN gerekli. Token yalnız yerel ortamda veya GitHub Actions secret olarak kullanılmalıdır.');
const api='https://zenodo.org/api/deposit/depositions';
const apiHeaders={Authorization:'Bearer '+token,Accept:'application/json','User-Agent':'DendroGeo/3.0 (https://dendrogeo.org)'};
async function call(url,method='GET',body){
 // Only the known Zenodo API may receive the token.
 const u=new URL(url);if(u.origin!=='https://zenodo.org'||!u.pathname.startsWith('/api/'))throw Error('Geçersiz Zenodo API adresi.');
 const res=await fetch(u,{method,redirect:'error',headers:{...apiHeaders,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
 if(!res.ok)throw Error('Zenodo '+method+' HTTP '+res.status);return res.json();
}
const snap=JSON.parse(readFileSync(join(dir,'data.json'),'utf8'));
const {metadata}=prepareReportDoi(dir);delete metadata.prereserve_doi;
const priorState=existsSync(statePath)?parseZenodoDepositState(readFileSync(statePath,'utf8'),id):null;
let deposit=priorState?await call(api+'/'+priorState.id):await call(api,'POST',{});
if(!Number.isSafeInteger(deposit.id)||deposit.id<1)throw Error('Zenodo taslak kimliği geçersiz.');
if(priorState&&deposit.id!==priorState.id)throw Error('Zenodo taslak kimliği beklenen kayıtla eşleşmiyor.');
writeFileSync(statePath,JSON.stringify({id:deposit.id,report_id:id},null,2)+'\n');
if(deposit.submitted){
 if(!deposit.doi)throw Error('Zenodo DOI yanıtı eksik.');
}else{
 const bucket=new URL(deposit.links.bucket);if(bucket.origin!=='https://zenodo.org'||!bucket.pathname.startsWith('/api/files/'))throw Error('Geçersiz yükleme adresi.');
 const temp=mkdtempSync(join(tmpdir(),'dendrogeo-doi-'));
 try{
  const zip=join(temp,id+'.zip');execFileSync('python3',['-c','import pathlib,zipfile,sys; p=pathlib.Path(sys.argv[1]); z=zipfile.ZipFile(sys.argv[2],"w",zipfile.ZIP_DEFLATED); [z.write(f,f.name) for f in sorted(p.iterdir()) if f.is_file() and f.name not in ("zenodo-deposit.json","doi.json")]; z.close()',dir,zip]);
  const res=await fetch(bucket.href+'/'+id+'.zip',{method:'PUT',redirect:'error',headers:{...apiHeaders,'Content-Type':'application/octet-stream'},body:readFileSync(zip)});
  if(!res.ok)throw Error('Zenodo dosya yükleme HTTP '+res.status);
 }finally{rmSync(temp,{recursive:true,force:true});}
 deposit=await call(api+'/'+deposit.id,'PUT',{metadata});
 if(!process.argv.includes('--publish')){console.log('Zenodo taslağı hazır: https://zenodo.org/deposit/'+deposit.id);process.exit(0);}
 deposit=await call(api+'/'+deposit.id+'/actions/publish','POST');
 if(!deposit.submitted||!deposit.doi)throw Error('Zenodo yayını yanıtında yayımlanmış kayıt bilgisi eksik.');
}
if(!/^10\.5281\/zenodo\.\d+$/.test(deposit.doi||''))throw Error('Zenodo tarafından verilmiş DOI doğrulanamadı.');
writeFileSync(doiPath,JSON.stringify({schema:'dendrogeo-doi/1',report_id:id,doi:deposit.doi,url:'https://doi.org/'+deposit.doi,record_url:'https://zenodo.org/records/'+deposit.id,registered_at:new Date().toISOString()},null,2)+'\n');
const previous=JSON.parse(readFileSync(join(dir,'metadata.json'),'utf8'));writeFileSync(join(dir,'metadata.json'),JSON.stringify(buildMetadata(snap,{id,hash:canonicalHash(snap),version:previous.version,meta:{...snap.provenance,doi:deposit.doi},history:(previous.history||[]).filter(h=>h.id!==id).map(h=>({...h,retracted:h.status==='Geri çekildi'}))}))+'\n');
await renderReportPdf(id,{force:true});
console.log('DOI kaydedildi: https://doi.org/'+deposit.doi);
