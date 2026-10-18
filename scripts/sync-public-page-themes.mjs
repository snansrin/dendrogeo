import {readdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {join,relative,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {applyPublicPageTheme} from './lib/public-page-theme.mjs';
const root=fileURLToPath(new URL('..',import.meta.url)),write=process.argv.includes('--write');
const sections=['agac-envanteri','arazi-ortusu','aydinlatma','en','gizlilik','hakkimizda','karbon-hesaplama','kent-parklari','kullanim-kosullari','kunye','ornekler','rapor','veri','yontem'];
let changed=0,count=0;
function walk(dir){
 // The HTML file is part of each published report manifest. Never rewrite it.
 if(existsSync(join(dir,'manifest.json')))return;
 for(const entry of readdirSync(dir,{withFileTypes:true})){
  const path=join(dir,entry.name);if(entry.isDirectory()){walk(path);continue;}
  if(!entry.name.endsWith('.html'))continue;
  let html=readFileSync(path,'utf8');
  if(!html.includes('dg-page')&&!html.includes('data-dg-public-page')&&!relative(root,path).replaceAll('\\','/').startsWith('rapor/'))continue;
  html=html.replace('<body>','<body class="dg-page">');
  const prefix=relative(dirname(path),root).replaceAll('\\','/')||'.';
  const next=applyPublicPageTheme(html,prefix);count++;
  if(next!==readFileSync(path,'utf8')){changed++;if(write)writeFileSync(path,next);else console.error('Eksik ortak tema: '+relative(root,path));}
 }
}
for(const name of sections)walk(join(root,name));
if(changed&&!write)process.exitCode=1;
console.log(`${count} kamu sayfası tema bağlantısı; ${changed} ${write?'güncellendi':'eksik'}. Yayımlanmış rapor dosyaları korunur.`);
