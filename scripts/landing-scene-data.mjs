import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const source=readFileSync(resolve(root,'assets/landing/goksu-example.json')),data=JSON.parse(source);
// Display-only simplification. Source coordinates, accepted areas and NDVI observations stay intact.
const rings=data.features.flatMap(f=>f.geometry.coordinates.flat()),points=rings.flat(),lat0=points.reduce((n,p)=>n+p[1],0)/points.length;
const xScale=Math.cos(lat0*Math.PI/180),xs=points.map(p=>p[0]*xScale),ys=points.map(p=>p[1]),minX=Math.min(...xs),maxY=Math.max(...ys),span=Math.max(Math.max(...xs)-minX,maxY-Math.min(...ys)),scale=380/span;
const project=([lon,lat])=>[100+(lon*xScale-minX)*scale,35+(maxY-lat)*scale];
function simplify(ring){const out=[];for(const point of ring){const p=project(point),last=out.at(-1);if(!last||Math.hypot(p[0]-last[0],p[1]-last[1])>.85)out.push(p);}return out.length>=3?out:ring.map(project);}
const path=coordinates=>coordinates.flatMap(poly=>poly.map(ring=>{const points=simplify(ring);return 'M'+points.map(p=>p.map(v=>v.toFixed(1)).join(',')).join('L')+'Z';})).join('');
const sourceFiles=['scripts/lib/report-overview-presentation.mjs','scripts/lib/report-method-section.mjs','scripts/lib/report-findings-sections.mjs','scripts/lib/report-verification-section.mjs','scripts/lib/report-provenance-presentation.mjs','scripts/lib/report-document-backmatter.mjs'];
const scene={schema:'dendrogeo-landing-scenes/1',sourceSha256:createHash('sha256').update(source).digest('hex'),park:data.park,acceptedAt:data.source.acceptedAt,areas:data.areas,outline:path(data.outer.map(ring=>[ring.map(([lat,lon])=>[lon,lat])])),surface:(data.displayFeatures||data.features).map(f=>({class:f.properties.class,path:path(f.geometry.coordinates)})),ndvi:{outline:path((data.ndvi.outer||data.outer).map(ring=>[ring.map(([lat,lon])=>[lon,lat])])),surfaceContext:data.ndvi.surfaceContext,count:data.ndvi.count,cutoffs:data.ndvi.cutoffs,acquiredAt:data.ndvi.acquiredAt,features:data.ndvi.features.map(f=>({class:f.properties.class,path:path(f.geometry.coordinates)}))},reportSources:sourceFiles.map(p=>({path:p,sha256:createHash('sha256').update(readFileSync(resolve(root,p))).digest('hex')}))};
const target=resolve(root,'assets/landing/goksu-scenes.json'),expected=JSON.stringify(scene)+'\n';
if(process.argv.includes('--write'))writeFileSync(target,expected);
else if(readFileSync(target,'utf8')!==expected)throw Error('Landing scene data is stale; run npm run build.');
console.log('✅ Landing sahneleri gerçek geometri, NDVI ve DGR kaynaklarıyla eşleşiyor.');
