import {chromium} from 'playwright-core';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,extname} from 'node:path';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage();
 let directSigningCalls=0;
 await page.route('https://planetarycomputer.microsoft.com/api/sas/v1/token/esa-worldcover*',route=>{directSigningCalls++;return route.abort('blockedbyclient');});
 // Serve the PR's files under the real application origin; external requests remain real browser fetches.
 await page.route('https://dendrogeo.org/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path==='/__worldcover-browser-qa'){
   const csp=readFileSync(resolve(root,'partials/head.html'),'utf8').match(/<meta http-equiv="Content-Security-Policy"[^>]+>/)[0];
   return route.fulfill({contentType:'text/html',body:'<!doctype html><html><head>'+csp+'</head><body><script id="dgRuntimeBuild" type="application/json">"cors-qa"</script></body></html>'});
  }
  const file=resolve(root,'.'+path);if(!file.startsWith(root+'/'))return route.abort();
  try{return route.fulfill({contentType:extname(file)==='.js'?'application/javascript':'application/octet-stream',body:readFileSync(file)});}catch{return route.abort();}
 });
 await page.goto('https://dendrogeo.org/__worldcover-browser-qa');
 // Only expose the existing public client configuration, never a service-role key.
 const config=readFileSync(resolve(root,'src/config/supabase.js'),'utf8');
 const publicConfig=['SB_URL','SB_KEY'].map(name=>'const '+name+'='+JSON.stringify(config.match(new RegExp(name+'="([^"]+)"'))[1])+';').join('\n');
 await page.addScriptTag({content:publicConfig});
 await page.addScriptTag({url:'https://dendrogeo.org/src/utils/lazylibs.js'});
 await page.evaluate(async()=>{await dgEnsureGeoTIFF();await dgEnsureLulc();});
 const result=await page.evaluate(async()=>{
  const token=await dgLcGetSas('esa-worldcover');
  if(!token)throw Error('No valid WorldCover access token');
  const href=dgLcSignedHref('https://ai4edataeuwest.blob.core.windows.net/esa-worldcover/v200/2021/map/ESA_WorldCover_10m_2021_v200_N39E030_Map.tif',token);
  const image=await(await dgLcOpenRaster(href)).getImage();
  const values=await image.readRasters({window:[31500,24000,31502,24002],samples:[0],interleave:true});
  const classes=new Set([10,20,30,40,50,60,70,80,90,95,100]);
  if(values.length!==4||![...values].every(x=>classes.has(x)))throw Error('Actual categorical WorldCover pixels were not read');
  return{width:image.getWidth(),height:image.getHeight(),pixelCount:values.length,classes:[...values]};
 });
 if(directSigningCalls!==0)throw Error('Browser still called the blocked Microsoft signing endpoint');
 console.log(JSON.stringify({origin:'https://dendrogeo.org',directSigningCalls,...result}));
 await context.close();
}finally{await browser.close();}
