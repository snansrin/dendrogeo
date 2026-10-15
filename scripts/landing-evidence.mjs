import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),write=process.argv.includes('--write'),errors=[];
const read=p=>readFileSync(resolve(root,p)),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const dataPath='assets/landing/goksu-example.json',data=JSON.parse(read(dataPath));
const modes=['map','analysis','drawing','ndvi','report'];
const images=modes.map(mode=>{const path='assets/landing/goksu-'+mode+'.jpg',bytes=read(path);if(bytes[0]!==255||bytes[1]!==216)throw Error(path+': geçerli JPEG değil');return{path,sha256:hash(bytes),capturePage:'ornekler/goksu-parki/?view='+mode};});
const evidence={schema:'dendrogeo-landing-evidence/1',captureDate:'2026-10-15',park:data.park,acceptedAt:data.source.acceptedAt,revision:data.source.revision,acceptance:'user-accepted; not independent accuracy assessment',sourceData:{path:dataPath,sha256:hash(read(dataPath))},ndvi:data.ndvi?{status:'real-observations',acquiredAt:data.ndvi.acquiredAt,scenes:data.ndvi.scenes}:{status:'no-saved-cell-observations'},reportStatus:'unpublished-preview; no DGR identifier or DOI assigned',images};
function sync(path,expected){const full=resolve(root,path),actual=existsSync(full)?readFileSync(full,'utf8'):null;if(actual===expected)return;if(write)writeFileSync(full,expected);else errors.push(path+' eski; npm run build ile güncelleyin.');}
sync('assets/landing/provenance.json',JSON.stringify(evidence,null,2)+'\n');
function versionHtml(path,base){const source=read(path).toString('utf8'),output=source.replace(/((?:src|href|data-source)=")([^"?#]+)(?:\?v=[a-f0-9]+)?(")/g,(all,prefix,ref,suffix)=>{if(/^(?:https?:|data:|#)/.test(ref)||!/[.](?:js|css|jpg|json)$/.test(ref))return all;const file=resolve(root,base,ref);if(!file.startsWith(root)||!existsSync(file))return all;return prefix+ref+'?v='+hash(readFileSync(file)).slice(0,8)+suffix;});sync(path,output);}
// The partial is served as the root document; the example owns its own relative URLs.
versionHtml('partials/landing.html','.');versionHtml('ornekler/goksu-parki/index.html','ornekler/goksu-parki');
if(errors.length){errors.forEach(error=>console.error('🔴 '+error));process.exitCode=1;}else console.log('✅ Landing gerçek kayıt/görsel kaynakları ve içerik sürümleri tutarlı.');
