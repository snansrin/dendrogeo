import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {canonicalHash} from './lib/mc.mjs';
const ROOT=join(dirname(fileURLToPath(import.meta.url)),'..');
/** Prepare a Zenodo report deposit without assigning or inventing a DOI.
 * Software DOIs and source dataset DOIs are related identifiers, never report identifiers. */
export function prepareReportDoi(dir){
 const md=JSON.parse(readFileSync(join(dir,'metadata.json'),'utf8'));
 const snap=JSON.parse(readFileSync(join(dir,'data.json'),'utf8'));
 if(md.publicationStage!=='production')throw Error('Yalnız üretim raporları DOI kaydına hazırlanabilir.');
 if(md.resultHash!=='sha256:'+canonicalHash(snap))throw Error('Rapor verisinin SHA-256 doğrulaması başarısız.');
 if(!existsSync(join(dir,'rapor.pdf')))throw Error('Doğrulanmış PDF çıktısı gerekli.');
 const metadata={upload_type:'publication',publication_type:'report',publication_date:md.generated.slice(0,10),title:md.title,creators:(snap.author?.name?[{name:snap.author.name,...(snap.study?.institution?{affiliation:snap.study.institution}:{}),...(snap.study?.orcid?{orcid:snap.study.orcid}:{})}]:[{name:'DendroGeo'}]),description:`<p>${snap.park.name}, ${snap.park.city}: ${md.sampleSize} moderatör onaylı ağaç ölçümünün envanteri ve model tabanlı karbon stoku analizi. Raporda yöntem, birimler, model belirsizlikleri, yüzey örtüsü alanları, kalite kontrolleri ve sınırlılıklar açıklanmıştır.</p><p>Rapor kimliği: ${md.identifier}; sürüm: ${md.version}; sonuç özeti SHA-256: ${md.resultHash.replace('sha256:','')}. Envanter kapsamı ölçülen bireylerle sınırlıdır; parkın tüm ağaçlarına genellenmez.</p>`,access_right:'open',license:'cc-by-nc-4.0',language:'tur',version:md.version,keywords:['urban forestry','tree inventory','carbon stock','land cover',snap.park.name],related_identifiers:[{identifier:md.url,relation:'isIdenticalTo',scheme:'url'}],...(md.doi?{doi:md.doi}:{prereserve_doi:true})};
 const files=['rapor.pdf','index.html','data.json','metadata.json','olcum.csv','park.geojson','harita.png',...(existsSync(join(dir,'surface.geojson'))?['surface.geojson']:[])];
 const manifest={report_id:md.identifier,result_hash:md.resultHash,doi:md.doi,registration_status:md.doi?'registered':'not_registered',files:files.map(name=>({name,sha256:createHash('sha256').update(readFileSync(join(dir,name))).digest('hex')}))};
 writeFileSync(join(dir,'zenodo-metadata.json'),JSON.stringify({metadata},null,2)+'\n');
 writeFileSync(join(dir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 return {metadata,manifest};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const id=process.argv[2];if(!/^DGR-\d{4}-\d{4}$/.test(id||''))throw Error('Kullanım: node scripts/prepare-report-doi.mjs DGR-YYYY-NNNN');
 const r=prepareReportDoi(join(ROOT,'rapor',id));console.log(JSON.stringify({report_id:id,files:r.manifest.files.length,doi:r.manifest.doi,status:r.manifest.registration_status}));
}
