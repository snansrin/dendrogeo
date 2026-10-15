#!/usr/bin/env node
/* Explicit publication maintenance: preserve the DOI archive and derive a new DGR. */
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {renderReport,buildMetadata,renderMapPNG,nextReportId,parkHistory,rebuildIndex,qrDataUri,fmtDateDot} from './make-report.mjs';
import {createReportArtifactWriter} from './lib/report-artifact-writer.mjs';
import {correctReportPresentation,MAP_PRESENTATION_CORRECTION,MAP_CORRECTION_NOTE} from './lib/report-presentation-correction.mjs';
import {reviewedSurface} from './surface-report.mjs';
import {mcRowCI} from './lib/mc.mjs';

export async function correctReportMap(sourceId,{root=join(dirname(fileURLToPath(import.meta.url)),'..')}={}){
 if(!/^DGR-\d{4}-\d{4}$/.test(sourceId))throw Error('Geçersiz kaynak rapor kimliği.');
 const dir=join(root,'rapor'),queuePath=join(dir,'yayin-kuyrugu.json');
 const queue=JSON.parse(readFileSync(queuePath,'utf8'));
 const existing=queue.entries.find(e=>e.correction_of===sourceId&&e.correction_kind===MAP_PRESENTATION_CORRECTION&&e.status==='Yayınlandı');
 if(existing)return{report_id:existing.report_id,skipped:true};
 if(!queue.entries.some(e=>e.report_id===sourceId&&e.status==='Yayınlandı')||queue.entries.some(e=>e.report_id===sourceId&&e.status==='Geri çekildi'))throw Error('Kaynak aktif üretim raporu olmalıdır.');
 const source=JSON.parse(readFileSync(join(dir,sourceId,'data.json'),'utf8'));
 const metadata=JSON.parse(readFileSync(join(dir,sourceId,'metadata.json'),'utf8'));
 const now=new Date().toISOString(),id=nextReportId(dir,Number(now.slice(0,4)));
 if(existsSync(join(dir,id)))throw Error('Rapor kimliği zaten var.');
 const gitCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
 const {snap,hash}=correctReportPresentation({source,metadata,id,generatedAt:now,gitCommit});
 const review=snap.lulc.review,surface=reviewedSurface(review,snap.park.id);
 const png=renderMapPNG({outer:review.outer[0],outers:review.outer,holes:review.holes||[],surfaceFeatures:review.displayFeatures||review.features,classes:surface.mapClasses,parkName:snap.park.name,sub:'KAYITLI ANALIZ - '+fmtDateDot(review.acceptedAt),points:snap.rows.map(r=>({lat:+r.lat,lon:+r.lon})),pointStat:{inside:snap.geofence.verified_rows,outside:snap.geofence.outside_rows},meta:{id,epsg:snap.lulc.epsg,dateStr:fmtDateDot(review.acceptedAt),source:'UYDU / OSM / KULLANICI KARARI',resolution:'UYDU 10/20 M; VEKTOR SINIR'}});
 const history=parkHistory(dir,snap.park.id,id).map(h=>h.id===sourceId?{...h,note:'Aynı kayıtlı analiz; harita sunumu bu raporda düzeltilmiştir.'}:h);
 const origin=new URL(metadata.url).origin;
 const meta={...snap.provenance,qr_uri:await qrDataUri(origin+'/rapor/'+id+'/')};
 createReportArtifactWriter({mkdirSync,writeFileSync,renderReport,buildMetadata,mcRowCI})({dir,id,snap,hash,png,version:1,verTxt:'1.0',meta,history});
 const prior=queue.entries.findLast(e=>e.report_id===sourceId&&e.status==='Yayınlandı');
 const entry={report_id:id,park_id:snap.park.id,park_name:snap.park.name,city:snap.park.city,n:snap.totals.n,version:1,status:'Yayınlandı',report_hash:'sha256:'+hash,url_path:'/rapor/'+id+'/',finished_at:now,with_lulc:true,surface_snapshot:true,carbon_txt:prior.carbon_txt,lulc:prior.lulc,correction_of:sourceId,correction_kind:MAP_PRESENTATION_CORRECTION,correction_note:MAP_CORRECTION_NOTE,doi_status:'Bekliyor'};
 queue.entries.push(entry);queue.updated_at=now;
 writeFileSync(queuePath,JSON.stringify(queue,null,2)+'\n');
 rebuildIndex(dir);
 return entry;
}
if(process.argv[1]===fileURLToPath(import.meta.url))console.log(JSON.stringify(await correctReportMap(process.argv[2])));
