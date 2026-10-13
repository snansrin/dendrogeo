import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkDependencyRules} from '../scripts/lib/dependency-rules.mjs';

test('dependency rules allow inward domain/application references and reject outward globals',()=>{
  const root=mkdtempSync(join(tmpdir(),'dendrogeo-dependency-rules-'));
  try{
    const write=(layer,name,source)=>{const directory=join(root,'src',layer);mkdirSync(directory,{recursive:true});writeFileSync(join(directory,name),source);};
    write('domain','allowed.js','window.DG_DOMAIN_RULES={};');
    write('domain','crossing.js','window.DG_CROSSING_DOMAIN={run(){return window.DG_UI_CARD.render();}};');
    write('application','use-case.js','window.DG_USE_CASE={run(){window.DG_DOMAIN_RULES.run();window.DG_USE_CASE_HELPER.run();}};');
    write('application','adapter-crossing.js','window.DG_ADAPTER_CALLER={run(){return window.DG_TREE_STORE.load();}};');
    write('application','helper.js','window.DG_USE_CASE_HELPER={run(){}};');
    write('adapters','store.js','window.DG_TREE_STORE={load(){}};');
    write('ui','card.js','window.DG_UI_CARD={render(){}};');

    const result=checkDependencyRules(root);
    assert.equal(result.checked,7);
    assert.equal(result.errors.length,2);
    assert.match(result.errors[0],/domain\/crossing\.js: domain references DG_UI_CARD from ui module/);
    assert.match(result.errors[1],/application\/adapter-crossing\.js: application references DG_TREE_STORE from adapters module/);
  }finally{rmSync(root,{recursive:true,force:true});}
});

test('current source modules obey the global module dependency rules',()=>{
  const result=checkDependencyRules(fileURLToPath(new URL('..',import.meta.url)));
  assert.deepEqual(result.errors,[]);
  assert.deepEqual(result.knownDebt.map(item=>`${item.relativePath}:${item.name}`),[
    'src/application/map/render-waypoint-gps-overlay.js:DG_CREATE_WAYPOINT_GPS_LOCATION_MARKER',
    'src/application/map/render-waypoint-gps-overlay.js:DG_RENDER_WAYPOINT_GPS_GUIDANCE_READOUT',
    'src/application/map/render-waypoint-gps-overlay.js:DG_ADD_WAYPOINT_GUIDANCE_LINE',
  ]);
});
