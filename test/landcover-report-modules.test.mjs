import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const modules=[
  'src/domain/surface/normalize-landcover-report-result.js',
  'src/domain/surface/build-landcover-report-model.js',
  'src/ui/render-landcover-report-rows.js',
  'src/ui/render-landcover-report-metadata.js',
  'src/ui/compose-landcover-report.js'
];
function app(withModules){const window={};const context=vm.createContext({window,DG_LC_CLASSES:[{key:'green',emoji:'🌳',label:'Yeşil',color:'#188038'},{key:'water',emoji:'💧',label:'Su',color:'#1677cc'},{key:'hard',emoji:'▰',label:'Sert',color:'#777777'},{key:'bare',emoji:'◌',label:'Çıplak',color:'#a67c52'},{key:'other',emoji:'?',label:'Diğer',color:'#555555'}],DG_LC_LAST:null});if(withModules)for(const path of modules)vm.runInContext(read(path),context,{filename:path});vm.runInContext(read('src/ui/lc-report.js'),context,{filename:'src/ui/lc-report.js'});return context;}

test('modular report rendering matches the existing compatibility renderer byte for byte',()=>{
  const result={groupCounts:{green:2,water:1},groupAreas:{green:800,water:200},rawCounts:{},rawAreas:{},classifiedAreaM2:900,maskedAreaM2:100,maskedCount:1,sourceCells:3,assignedAreaM2:1000,agreement:{green:{agreementPct:87.4}},patches:[{group:'green',areaM2:2000}]},extra={primaryYear:2024,primaryLabel:'Uydu karşılaştırması',primaryCitation:'WorldCover',crossCitation:'Sentinel',crossError:false,agreement:result.agreement,patches:result.patches};
  const legacy=app(false),modular=app(true),oldReport={innerHTML:''},newReport={innerHTML:''};
  legacy.dgLcRenderReport(oldReport,result,1000,extra);modular.dgLcRenderReport(newReport,result,1000,extra);
  assert.equal(newReport.innerHTML,oldReport.innerHTML);assert.match(newReport.innerHTML,/geometrik QA geçti/);assert.match(newReport.innerHTML,/en büyük 0\.20 ha/);assert.match(newReport.innerHTML,/Çapraz kaynak|Sentinel/);
});

test('legacy raw result shape normalizes established area and coverage fallbacks',()=>{
  const context=app(true),model=context.window.DG_LANDCOVER_REPORT_MODEL.build({result:{groupCounts:{green:1},groupAreasM2:{green:125},rawCounts:{},rawAreasM2:{},classifiedAreaM2:100,rasterCoverageAreaM2:250,sourceCells:1},parkAreaM2:250,classes:context.DG_LC_CLASSES});
  assert.equal(model.result.groupAreas.green,125);assert.equal(model.analysisArea,250);assert.equal(model.rows[0].pct,50);assert.equal(model.qa.passed,true);
});

test('all five report modules load and are precached before lc-report',()=>{
  const chain=read('src/utils/lazylibs.js'),sw=read('sw.js');
  for(const path of modules){assert.ok(chain.includes(`"${path}"`));assert.ok(sw.includes(`'/${path}'`));assert.ok(chain.indexOf(`"${path}"`)<chain.indexOf('"src/ui/lc-report.js"'));}
  assert.match(chain,/normalize-landcover-report-result\.js[\s\S]*?build-landcover-report-model\.js[\s\S]*?render-landcover-report-rows\.js[\s\S]*?render-landcover-report-metadata\.js[\s\S]*?compose-landcover-report\.js[\s\S]*?lc-report\.js/);
});
