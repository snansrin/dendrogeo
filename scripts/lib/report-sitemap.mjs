import {existsSync,readFileSync,writeFileSync} from 'node:fs';
/* The mutable discovery index follows the same valid snapshots as the gallery. */
export function renderReportSitemap(xml,reports){
 const entries=reports.filter(r=>/^DGR-\d{4}-\d{4}$/.test(r.id)&&/^\d{4}-\d{2}-\d{2}$/.test(r.date));
 const urls=[...new Map(entries.map(r=>[r.id,r])).values()].sort((a,b)=>a.id.localeCompare(b.id));
 let result=xml.replace(/^[ \t]*<url>\s*<loc>https:\/\/dendrogeo\.org\/rapor\/DGR-\d{4}-\d{4}\/<\/loc>[\s\S]*?<\/url>\r?\n?/gm,'');
 const latest=urls.map(r=>r.date).sort().at(-1);
 if(latest)result=result.replace(/(<loc>https:\/\/dendrogeo\.org\/rapor\/<\/loc><lastmod>)[^<]+/,(_,prefix)=>prefix+latest);
 const rows=urls.map(r=>'  <url><loc>https://dendrogeo.org/rapor/'+r.id+'/</loc><lastmod>'+r.date+'</lastmod></url>').join('\n');
 return result.replace(/<\/urlset>/,(rows?rows+'\n':'')+'</urlset>');
}
export function syncReportSitemap(path,reports,{write=false}={}){
 if(!existsSync(path))return true;
 const current=readFileSync(path,'utf8'),next=renderReportSitemap(current,reports);
 if(current===next)return true;
 if(write)writeFileSync(path,next);
 return false;
}
