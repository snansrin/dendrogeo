import {readFileSync,writeFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readReportIndex} from './lib/report-archive.mjs';
import {syncReportSitemap} from './lib/report-sitemap.mjs';
const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const write=process.argv.includes('--write');
const sitemapPath=join(root,'sitemap.xml');
let xml=readFileSync(sitemapPath,'utf8');
const original=xml;
const policies=['privacy','data-protection','terms'];
for(const slug of policies){const url='https://dendrogeo.org/en/'+slug+'/';if(!xml.includes('<loc>'+url+'</loc>'))xml=xml.replace('</urlset>','  <url><loc>'+url+'</loc><lastmod>2026-10-19</lastmod></url>\n</urlset>');}
xml=xml.replace(/(<loc>https:\/\/dendrogeo\.org\/en\/<\/loc>)([\s\S]*?)(<\/url>)/,(_,loc,rest,end)=>loc+rest.replace(/<lastmod>[^<]+<\/lastmod>/g,'')+'<lastmod>2026-10-19</lastmod>'+end);
const queue=JSON.parse(readFileSync(join(root,'rapor/yayin-kuyrugu.json'),'utf8'));
const dates=(queue.entries||[]).filter(entry=>entry.status==='Geri çekildi').map(entry=>entry.finished_at||entry.completed_at||entry.started_at).filter(value=>/^\d{4}-\d{2}-\d{2}/.test(value)).map(value=>value.slice(0,10)).sort();
const activeReports=readReportIndex();
const archiveDate=activeReports.length?activeReports.map(report=>report.date).sort().at(-1):dates.at(-1);
if(archiveDate)xml=xml.replace(/(<loc>https:\/\/dendrogeo\.org\/rapor\/<\/loc><lastmod>)[^<]+/,(_,prefix)=>prefix+archiveDate);
if(xml!==original){if(write)writeFileSync(sitemapPath,xml);else{console.error('Kamu sayfası tarihleri veya İngilizce politika yolları eski.');process.exitCode=1;}}
const current=syncReportSitemap(join(root,'sitemap.xml'),activeReports,{write});
if(!current&&!write){console.error('Site haritasının rapor listesi eski; npm run build çalıştırın.');process.exitCode=1;}
else console.log('✅ Site haritası geçerli rapor diziniyle eşleşiyor.');
