import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readReportIndex} from './lib/report-archive.mjs';
import {syncReportSitemap} from './lib/report-sitemap.mjs';
const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const write=process.argv.includes('--write');
const current=syncReportSitemap(join(root,'sitemap.xml'),readReportIndex(),{write});
if(!current&&!write){console.error('Site haritasının rapor listesi eski; npm run build çalıştırın.');process.exitCode=1;}
else console.log('✅ Site haritası geçerli rapor diziniyle eşleşiyor.');
