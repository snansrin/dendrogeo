#!/usr/bin/env node
import{readFileSync,writeFileSync,readdirSync,existsSync}from'node:fs';import{join,dirname}from'node:path';import{fileURLToPath,pathToFileURL}from'node:url';import{chromium}from'playwright-core';import{execFileSync}from'node:child_process';import{renderReport,qrDataUri,DGR_ID_RE}from'./make-report.mjs';import{canonicalHash}from'./lib/mc.mjs';import{prepareReportDoi}from'./prepare-report-doi.mjs';
const ROOT=join(dirname(fileURLToPath(import.meta.url)),'..');
export async function renderReportPdf(id,{root=ROOT,browser=process.env.DG_REPORT_BROWSER,force=false}={}){
 if(!DGR_ID_RE.test(id))throw Error('Geçersiz rapor kimliği.');const dir=join(root,'rapor',id),pdf=join(dir,'rapor.pdf');if(existsSync(pdf)&&!force)return{skipped:true,id};
 const snap=JSON.parse(readFileSync(join(dir,'data.json'),'utf8')),md=JSON.parse(readFileSync(join(dir,'metadata.json'),'utf8')),hash=canonicalHash(snap);if(md.publicationStage!=='production'||md.resultHash!=='sha256:'+hash)throw Error('Üretim raporunun veri bütünlüğü doğrulanamadı.');
 const executable=[browser,'/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium','/usr/bin/chromium-browser'].filter(Boolean).find(existsSync);if(!executable)throw Error('PDF üretimi için Chrome/Chromium bulunamadı; DG_REPORT_BROWSER yolunu ayarlayın.');
 const meta={...snap.provenance,history:(md.history||[]).filter(h=>h.id!==id).map(h=>({...h,retracted:h.status==='Geri çekildi'})),doi:md.doi,pdf_path:'rapor.pdf',qr_uri:await qrDataUri(md.url)};
 const html=renderReport(snap,{id,hash,version:md.version,meta});writeFileSync(join(dir,'index.html'),html);
 const browserInstance=await chromium.launch({executablePath:executable,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});try{const page=await browserInstance.newPage({viewport:{width:1100,height:900}});await page.goto(pathToFileURL(join(dir,'index.html')).href);await page.waitForFunction(()=>document.getElementById('dgVerify')?.textContent.includes('doğrulandı'),null,{timeout:15000});await page.pdf({path:pdf,format:'A4',preferCSSPageSize:true,printBackground:true,displayHeaderFooter:false,tagged:true,outline:true});}finally{await browserInstance.close();}
 const output=readFileSync(pdf);if(output.length<10000||!output.subarray(0,5).equals(Buffer.from('%PDF-')))throw Error('Geçerli PDF çıktısı üretilemedi.');
 prepareReportDoi(dir);
 execFileSync('python3',['-c',`import pathlib,zipfile,sys
p=pathlib.Path(sys.argv[1]);standard=pathlib.Path(sys.argv[2])
with zipfile.ZipFile(p/'doi-yayin-paketi.zip','w',zipfile.ZIP_DEFLATED) as z:
 for f in sorted(p.iterdir()):
  if f.is_file() and f.suffix!='.zip':z.write(f,f.name)
 z.write(standard,'YAYIN-STANDARDI.md')`,dir,join(root,'docs/report-production-standard.md')],{timeout:30000,stdio:'pipe'});
 return{id,bytes:output.length,doi:md.doi||null};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const pos=process.argv.indexOf('--report'),ids=pos>=0?[process.argv[pos+1]]:readdirSync(join(ROOT,'rapor')).filter(id=>DGR_ID_RE.test(id)&&existsSync(join(ROOT,'rapor',id,'data.json')));for(const id of ids)console.log(JSON.stringify(await renderReportPdf(id,{force:process.argv.includes('--force')})));
}
