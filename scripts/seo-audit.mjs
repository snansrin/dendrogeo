import {readFileSync} from 'node:fs';
import {INDEXABLE_PATHS,PUBLIC_DOCUMENT_PATHS,SITE_ORIGIN} from './lib/public-indexing-policy.mjs';
const live=process.argv.includes('--live'),sitemap=readFileSync('sitemap.xml','utf8'),entries=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match=>match[1]),urls=PUBLIC_DOCUMENT_PATHS.map(path=>SITE_ORIGIN+path);let failures=0;
if(JSON.stringify(entries)!==JSON.stringify(INDEXABLE_PATHS.map(path=>SITE_ORIGIN+path))){console.error('Sitemap must contain exactly the TR/EN landing URLs.');failures++;}
for(const url of urls){const pathname=new URL(url).pathname,path=pathname==='/'?'index.html':pathname.slice(1)+'index.html';let html,status=200;if(live){const response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(20000)});html=await response.text();status=response.status;}else html=readFileSync(path,'utf8');
 const canonical=html.match(/rel="canonical" href="([^"]+)"/)?.[1],title=html.match(/<title>([^<]+)<\/title>/)?.[1],noindex=/name="robots"[^>]*noindex/i.test(html),h1=[...html.matchAll(/<h1\b/gi)].length;
 const indexable=INDEXABLE_PATHS.includes(pathname),ok=status===200&&canonical===url&&noindex===!indexable&&!!title&&h1===1;if(!ok)failures++;console.log(JSON.stringify({url,status,canonical,indexable,noindex,h1,ok}));
}
if(live)for(const url of ['http://dendrogeo.org/','http://www.dendrogeo.org/','https://www.dendrogeo.org/']){const response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(20000)}),location=response.headers.get('location'),ok=[301,308].includes(response.status)&&location==='https://dendrogeo.org/';if(!ok)failures++;console.log(JSON.stringify({url,status:response.status,location,expectedCanonicalRedirect:ok}));}
console.log(JSON.stringify({documents:urls.length,failures}));if(failures)process.exitCode=1;
