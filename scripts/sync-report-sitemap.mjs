import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {syncReportSitemap} from './lib/report-sitemap.mjs';
const root=fileURLToPath(new URL('..',import.meta.url)),write=process.argv.includes('--write');
const current=syncReportSitemap(join(root,'sitemap.xml'),[],{write});
if(!current&&!write){console.error('Site haritasında yalnız TR/EN landing bulunmalı; npm run build çalıştırın.');process.exitCode=1;}
else console.log('✅ Site haritası yalnız TR/EN landing içeriyor.');
