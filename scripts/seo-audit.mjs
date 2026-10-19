import {readFileSync} from 'node:fs';
const live=process.argv.includes('--live'),sitemap=readFileSync('sitemap.xml','utf8'),urls=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match=>match[1]);let failures=0;
for(const url of urls){const pathname=new URL(url).pathname,path=pathname==='/'?'index.html':pathname.slice(1)+'index.html';let html,status=200;if(live){const response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(20000)});html=await response.text();status=response.status;}else html=readFileSync(path,'utf8');
 const canonical=html.match(/rel="canonical" href="([^"]+)"/)?.[1],title=html.match(/<title>([^<]+)<\/title>/)?.[1],noindex=/name="robots"[^>]*noindex/i.test(html),h1=[...html.matchAll(/<h1\b/gi)].length;
 const ok=status===200&&canonical===url&&!noindex&&!!title&&h1===1;if(!ok)failures++;console.log(JSON.stringify({url,status,canonical,noindex,h1,ok}));
}
if(live)for(const url of ['http://dendrogeo.org/','http://www.dendrogeo.org/','https://www.dendrogeo.org/']){const response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(20000)}),location=response.headers.get('location'),ok=[301,308].includes(response.status)&&location==='https://dendrogeo.org/';if(!ok)failures++;console.log(JSON.stringify({url,status:response.status,location,expectedCanonicalRedirect:ok}));}
console.log(JSON.stringify({documents:urls.length,failures}));if(failures)process.exitCode=1;
