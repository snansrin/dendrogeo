import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {join,dirname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {applyDocumentIdentity} from './lib/public-site-seo.mjs';
import {PUBLIC_DOCUMENT_PATHS,SITE_ORIGIN,applyIndexingPolicy} from './lib/public-indexing-policy.mjs';
const root=fileURLToPath(new URL('..',import.meta.url)),write=process.argv.includes('--write');let changed=0;
function save(path,next){if(existsSync(join(root,path))&&readFileSync(join(root,path),'utf8')===next)return;changed++;if(write)writeFileSync(join(root,path),next);else console.error('Güncel olmayan kamu site varlığı: '+path);}
const config=readFileSync(join(root,'src/config/supabase.js'),'utf8');
const url=config.match(/const SB_URL="([^"]+)"/)[1],key=config.match(/const SB_KEY="([^"]+)"/)[1];
if(JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString()).role!=='anon')throw Error('Only the public anonymous key may be used by the site counter.');
save('src/config/site-traffic-config.js','/* Generated from the existing public backend configuration; no account token. */\nwindow.DG_SITE_TRAFFIC_CONFIG=Object.freeze('+JSON.stringify({url:url+'/functions/v1/site-metrics',key})+');\n');
const revision=readFileSync(join(root,'sw.js'),'utf8').match(/const CACHE_VERSION = '([^']+)'/)[1];
// Maintenance is independent of search visibility and sitemap membership.
const urls=PUBLIC_DOCUMENT_PATHS.map(path=>SITE_ORIGIN+path);
for(const canonical of urls){
 const pathname=new URL(canonical).pathname,home=pathname==='/',path=home?'partials/head.html':pathname.slice(1)+'index.html';
 let html=readFileSync(join(root,path),'utf8');
 if(!html.includes('rel="canonical" href="'+canonical+'"'))throw Error('Canonical URL eşleşmiyor: '+path);
 const decode=value=>value?.replaceAll('&amp;','&').replaceAll('&quot;','"').replaceAll('&#39;',"'");
 const title=decode(html.match(/<title>([^<]+)<\/title>/)?.[1]),description=decode(html.match(/name="description" content="([^"]+)"/)?.[1])||title;
 const language=html.match(/<html[^>]*lang="([^"]+)"/)?.[1]||'tr';
 html=applyDocumentIdentity(html,{url:canonical,title,description,language,home});
 html=applyIndexingPolicy(html,pathname);
 const prefix=home?'.':relative(dirname(join(root,path)),root).replaceAll('\\','/')||'.';
 const scripts=['src/config/site-traffic-config.js','src/domain/visitors/traffic-categories.js','src/adapters/visitors/send-site-metric.js','src/bootstrap/site-traffic.js'];
 const block='<!-- dg-site-traffic -->\n'+scripts.map(file=>'<script src="'+(home?'':prefix+'/')+file+'?v='+(home?'00000000':createHash('sha256').update(revision).update(readFileSync(join(root,file))).digest('hex').slice(0,8))+'" defer></script>').join('\n')+'\n<!-- /dg-site-traffic -->\n';
 html=html.replace(/<!-- dg-site-traffic -->[\s\S]*?<!-- \/dg-site-traffic -->\s*/g,'').replace('</head>',block+'</head>');
 save(path,html);
}
if(changed&&!write)process.exitCode=1;
console.log(`${urls.length} canonical belge: site kimliği, belge hiyerarşisi ve anonim sayaç ${changed?'güncellendi':'tutarlı'}.`);
