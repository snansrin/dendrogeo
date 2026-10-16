import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/ui/park-landcover-analysis.js',import.meta.url),'utf8');

function fixture(overrides={}){
 const calls=[];
 const classes=new Set();
 const map={classList:{add:value=>classes.add(value),remove:value=>classes.delete(value)}};
 const pending={style:{display:'none'}};
 const base={value:'satellite'};
 const button={disabled:false,innerHTML:'🌿 Analiz',dataset:{},style:{opacity:'',cursor:''}};
 const report={style:{display:'none'},innerHTML:''};
 const elements={'v-map':map,surfacePendingTools:pending,dgPendingBaseSelect:base,baseLayerSelect:{value:'satellite'}};
 let busy=false;
 let landcover=overrides.landcover||null;
 const outer=[[40,32],[40,32.01]];
 const deps={
  isBusy:()=>busy,setBusy:value=>{busy=value;},getLandcover:()=>landcover,
  ensureLulc:async()=>{calls.push(['ensure']);landcover=overrides.loadedLandcover||{analyze:args=>{calls.push(['analyze',args]);return Promise.resolve({classes:[]});}};},
  getOuter:()=>outer,getHoles:()=>[],parkAreaM2:()=>2500,
  getElement:id=>elements[id]||null,getButton:()=>button,getReport:()=>report,
  getReportRenderer:()=>((...args)=>calls.push(['render',...args])),
  getSensitivity:()=>({mount:async id=>calls.push(['mount',id]),state:{record:null}}),
  hasSensitivityRecord:()=>false,toast:(...args)=>calls.push(['toast',...args]),
  cf:value=>value,escape:value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'),...overrides.deps
 };
 const context=vm.createContext({window:{}});
 vm.runInContext(source,context);
 return {ui:context.window.DG_PARK_LANDCOVER_UI.create(deps),calls,classes,pending,base,button,report,get busy(){return busy;}};
}

test('park LULC UI controller is loaded before its download adapter and precached',()=>{
 const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 assert.ok(index.indexOf('src/ui/park-export-canvas.js')<index.indexOf('src/ui/park-landcover-analysis.js'));
 assert.ok(index.indexOf('src/ui/park-landcover-analysis.js')<index.indexOf('src/ui/park-export.js'));
 assert.match(index,/src\/ui\/park-landcover-analysis\.js\?v=[a-f0-9]{8}/);
 assert.match(sw,/\/src\/ui\/park-landcover-analysis\.js/);
});

test('lazy load, analysis, report and sensitivity success preserve UI cleanup',async()=>{
 const f=fixture();
 await f.ui.run();
 assert.deepEqual(f.calls.filter(x=>['ensure','analyze','render','mount'].includes(x[0])).map(x=>x[0]),['ensure','analyze','render','mount']);
 const args=f.calls.find(x=>x[0]==='analyze')[1];
 assert.deepEqual(args.outer,[[40,32],[40,32.01]]);
 assert.deepEqual(args.holes,[]);
 assert.equal(args.parkAreaM2,2500);
 assert.equal(f.base.value,'satellite');
 assert.equal(f.calls.find(x=>x[0]==='mount')[1],'lcSens');
 assert.equal(f.busy,false);
 assert.equal(f.pending.style.display,'none');
 assert.equal(f.button.disabled,false);
 assert.equal(f.button.innerHTML,'🌿 Analiz');
 assert.ok(!f.classes.has('surface-review-active'));
 assert.ok(f.calls.some(x=>x[0]==='toast'&&x[1].startsWith('✓ 10 m')));
});

test('analysis rejection reports escaped error and always restores controls',async()=>{
 const f=fixture({landcover:{analyze:async()=>{throw new Error('<bad>');}}});
 await f.ui.run();
 assert.match(f.report.innerHTML,/&lt;bad&gt;/);
 assert.equal(f.busy,false);
 assert.equal(f.pending.style.display,'none');
 assert.equal(f.button.disabled,false);
 assert.ok(!f.classes.has('surface-review-active'));
 assert.ok(f.calls.some(x=>x[0]==='toast'&&String(x[1]).includes('<bad>')));
});

test('busy, failed lazy load and missing park retain early-exit behavior',async()=>{
 const busy=fixture({deps:{isBusy:()=>true}});
 await busy.ui.run();
 assert.equal(busy.calls.length,1);
 assert.equal(busy.busy,false);

 const failed=fixture({deps:{ensureLulc:async()=>{throw new Error('offline');}}});
 await failed.ui.run();
 assert.ok(failed.calls.some(x=>x[0]==='toast'&&String(x[1]).includes('offline')));
 assert.equal(failed.busy,false);

 const noPark=fixture({landcover:{analyze:async()=>({})},deps:{getOuter:()=>[]}});
 await noPark.ui.run();
 assert.equal(noPark.busy,false);
 assert.ok(noPark.calls.some(x=>x[0]==='toast'&&x[1]==='Önce park seç'));
});

test('first click locks controls during cold module download and continues automatically exactly once',async()=>{
 let release,analyzes=0,loaded=null;
 const f=fixture({deps:{getLandcover:()=>loaded,ensureLulc:()=>new Promise(resolve=>release=()=>{loaded={analyze:async()=>{analyzes++;return{};}};resolve();})}});
 const pending=f.ui.run();assert.equal(f.busy,true);assert.equal(f.button.disabled,true);assert.equal(f.report.style.display,'block');
 await f.ui.run();assert.equal(analyzes,0);release();await pending;
 assert.equal(analyzes,1);assert.equal(f.busy,false);assert.equal(f.button.disabled,false);
});
test('synchronous engine failure restores button and allows retry without a stuck busy flag',async()=>{
 const f=fixture({landcover:{analyze(){throw Error('sync failure');}}});await f.ui.run();assert.equal(f.busy,false);assert.equal(f.button.disabled,false);assert.match(f.report.innerHTML,/sync failure/);
});
