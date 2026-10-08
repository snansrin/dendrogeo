import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

// User-approved working analysis, 8 October 2026. No automatic lock regeneration.
const MANIFEST_SHA256 = "42510744b5438265a53b4fbb61611670281f319c15d1a5355738fc516c085bc7";
const root=fileURLToPath(new URL('..',import.meta.url));
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');

export function verifyAnalysisLock(base=root){
 const errors=[];
 let bytes;
 try{bytes=readFileSync(resolve(base,'docs/verified-analysis-lock.json'));}
 catch{ return ['Analysis lock manifest is missing.']; }
 if(sha256(bytes)!==MANIFEST_SHA256)return ['Analysis lock manifest changed. Explicit user approval is required; do not regenerate the hashes.'];
 const manifest=JSON.parse(bytes);
 for(const [path,expected] of Object.entries(manifest.files)){
  try{if(sha256(readFileSync(resolve(base,path)))!==expected)errors.push(path+' changed from the verified analysis.');}
  catch{errors.push(path+' is missing.');}
 }
 return errors;
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const errors=verifyAnalysisLock();
 if(errors.length){console.error('VERIFIED ANALYSIS LOCK FAILED\n'+errors.join('\n')+'\nRestore the protected files. Changing this lock requires explicit user approval.');process.exitCode=1;}
 else console.log('Verified analysis lock passed: raster engine, satellite scan, OSM masks, geometry, rendering, loader and browser cache remain unchanged.');
}
