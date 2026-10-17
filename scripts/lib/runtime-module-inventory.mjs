import {readFileSync,readdirSync,statSync,existsSync} from 'node:fs';import {join,posix} from 'node:path';
export const isCriticalRuntimeModule=path=>/^src\/(?:ui|bootstrap)\/(?:gis-|park-|scientific-species-select)/.test(path)||/^src\/(?:domain|application|adapters)\/(?:trees|surface|parks|map|offline|waypoints)\//.test(path)||/^src\/(?:contracts|workers)\//.test(path)||(/^src\/ui\//.test(path)&&/(?:surface|measurement|park-|waypoint|grid-|landcover|lc-)/.test(path));
const paths=text=>[...text.matchAll(/["'](\/?src\/[^"'\s?]+\.js)(?:\?[^"']*)?["']/g)].map(m=>m[1].replace(/^\//,''));
function walk(root,directory){return readdirSync(join(root,directory),{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(root,directory+'/'+e.name):e.name.endsWith('.js')?[directory+'/'+e.name]:[]);}
export function collectRuntimeModules(root){
 const read=p=>readFileSync(join(root,p),'utf8'),physical=walk(root,'src'),initial=paths(read('partials/head.html')+read('partials/boot.html')),lazy=paths(read('src/utils/lazylibs.js')),loaded=new Set([...initial,...lazy,'src/bootstrap/app-runtime.js']),dependencies=new Set(),queue=[...loaded];
 for(let i=0;i<queue.length;i++){const path=queue[i];if(!existsSync(join(root,path))||path==='src/bootstrap/app-runtime.js')continue;const source=read(path),next=paths(source).filter(p=>p.startsWith("src/workers/"));if(path.startsWith('src/workers/'))for(const m of source.matchAll(/["'](\.\.\/[^"'\s?]+\.js)["']/g))next.push(posix.normalize(posix.join(posix.dirname(path),m[1])));
  for(const dependency of next){dependencies.add(dependency);if(!loaded.has(dependency)){loaded.add(dependency);queue.push(dependency);}}
 }
 const foundation=JSON.parse(read('docs/core-foundation-lock.json'));
 return{physical,initial,lazy,loaded,dependencies,exists:p=>statSync(join(root,p),{throwIfNoEntry:false})?.isFile()===true,protected:new Set(Object.keys(foundation.sha256||{}))};
}
