import {spawnSync} from 'node:child_process';
import {serveFixture} from './lib/browser-acceptance-fixture.mjs';
// Each interaction script owns its server; layout scripts share one afterwards.
for(const script of ['road-width-smoke','park-boundary-recovery-smoke','grid-menu-smoke','harikalar-grid-smoke','surface-map-download-smoke','scientific-species-select-smoke','public-page-theme-smoke','landing-showcase-smoke','startup-smoke','profile-smoke','projects-workspace-smoke','shared-park-surface-smoke','appearance-smoke','ui-consistency-smoke','report-form-smoke','field-methods-smoke','park-admin-smoke','brush-smoke','drawing-smoke','park-draw-smoke','osm-map-recovery-smoke','park-analysis-interaction-smoke','surface-menu-smoke','mobile-tools-language-smoke','measurement-save-smoke']){
 const result=spawnSync(process.execPath,['scripts/'+script+'.mjs'],{stdio:'inherit'});if(result.status!==0)process.exit(result.status||1);
}
const imagery=spawnSync(process.execPath,['scripts/imagery-tile-recovery-smoke.mjs'],{stdio:'inherit'});if(imagery.status!==0)process.exit(imagery.status||1);
const server=await serveFixture(8765);
try{for(const script of ['mobile-smoke','gis-mobile-qa']){
 // Async child process lets the local server answer requests.
 const {spawn}=await import('node:child_process');const code=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,['scripts/'+script+'.mjs'],{stdio:'inherit'});child.on('error',reject);child.on('exit',resolve);});if(code!==0)throw Error(script+' failed ('+code+')');
}}finally{await server.close();}
