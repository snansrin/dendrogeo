import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {landingOnlySitemap} from './public-indexing-policy.mjs';
/* Keep publication/retraction call contracts; search discovery is landing-only. */
export function renderReportSitemap(xml,_reports){return landingOnlySitemap(xml);}
export function syncReportSitemap(path,reports,{write=false}={}){
 if(!existsSync(path))return true;
 const current=readFileSync(path,'utf8'),next=renderReportSitemap(current,reports);
 if(current===next)return true;
 if(write)writeFileSync(path,next);
 return false;
}
