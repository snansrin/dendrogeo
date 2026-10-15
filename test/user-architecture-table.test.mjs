import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import vm from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('all source switches and ranges use the shared native control classes',()=>{
 const files=['partials/landing.html','partials/shell.html',...readdirSync(new URL('../src/ui/',import.meta.url)).filter(f=>f.endsWith('.js')).map(f=>'src/ui/'+f),'src/services/academic-profile.js'];
 let switches=0,ranges=0;
 for(const file of files)for(const match of read(file).matchAll(/<input\b[^>]*>/g)){
  const tag=match[0];if(/type=["']checkbox["']/.test(tag)){switches++;assert.match(tag,/\bdg-switch\b/,file);}
  if(/type=["']range["']/.test(tag)){ranges++;assert.match(tag,/\bdg-range\b/,file);}
 }
 assert.ok(switches>=10);assert.ok(ranges>=2);
 const sensitivity=read('src/ui/render-surface-sensitivity-controls.js');
 assert.match(sensitivity,/for\(const key of classes\)/);assert.match(sensitivity,/type="range" class="dg-sens-slider dg-range"/);
 assert.match(read('src/ui/lc-sens.js'),/DG_SENS_CLASSES=\["green","water","hard","bare"\]/);
 assert.match(read('css/style.css'),/input\.dg-range\{[^}]*min-height:44px[^}]*padding:0/);
});
test('raw field naming and read-only DBH display keep full precision outside the view',()=>{
 assert.match(read('partials/shell.html'),/<input id="mDbh" name="girth_cm"/);
 const context=vm.createContext({window:{}});vm.runInContext(read('src/ui/render-live-measurement-preview.js'),context);
 const diameter=57/Math.PI,result={dbh_cm:diameter,total_carbon:44.78937,agb:80,bhb:10,vol:0.1,density_kg_m3:650},element={style:{}};
 context.window.DG_RENDER_LIVE_MEASUREMENT_PREVIEW.render({preview:{show:true,result,request:{circumferenceCm:57}},element,getHint:()=>null,translate:x=>x});
 assert.match(element.innerHTML,/<output name="dbh_cm_display" for="mDbh">18\.1<\/output>/);
 assert.equal(result.dbh_cm,diameter);assert.ok(result.dbh_cm!==18.1);
});
test('display opacity changes styling and display preference without touching raw or accepted geometry',()=>{
 const context=vm.createContext({window:{}});vm.runInContext(read('src/ui/update-surface-opacity.js'),context);
 const record={cells:[{rawClassCode:50,classKey:'building',areaM2:65.8}],acceptedResult:{areas:{building:65.8},geometry:{type:'Polygon',coordinates:[[[0,0],[1,0],[1,1],[0,0]]]}}},snapshot=JSON.stringify(record),styles=[];
 const state={record,displayPaths:[{poly:{setStyle:s=>styles.push(s)}}]},output={};
 context.window.DG_UPDATE_SURFACE_OPACITY.update({state,value:25,document:{getElementById:()=>output},clearTimer(){},setTimer:()=>1,save(){}});
 const {displayOpacity,...data}=record;assert.equal(JSON.stringify(data),snapshot);assert.equal(displayOpacity,25);assert.equal(styles[0].fillOpacity,0.25);assert.equal(output.textContent,'%25');
});
test('every PR runs full source validation and reusable phone/accessibility gates before publication',()=>{
 const pkg=JSON.parse(read('package.json')),ci=read('.github/workflows/ci.yml'),mobile=read('.github/workflows/mobile-smoke.yml');
 for(const name of ['check:phone','check:accessibility','check:sql','check:release'])assert.ok(pkg.scripts[name]);
 assert.match(ci,/pull_request:/);assert.match(ci,/run: npm run check\n/);assert.match(ci,/needs: \[dogrula, telefon\]/);assert.match(ci,/uses: \.\/.github\/workflows\/mobile-smoke.yml/);
 assert.match(mobile,/workflow_call:/);assert.match(mobile,/npm run check:phone/);assert.match(mobile,/npm run check:accessibility/);
 for(const file of ['rapor.yml','rapor-yayin.yml','doi.yml']){const source=read('.github/workflows/'+file),gate=source.indexOf('run: npm run check:release'),write=source.search(/node scripts\/(?:make-report|publish-queue|register-doi)\.mjs/);assert.ok(gate>=0&&gate<write,file);if(file!=='rapor.yml')assert.match(source,/if: always\(\) && steps.validation.outcome == 'success'/);}
});
test('auth display injects the timer with its native window receiver',()=>{
 assert.match(read('src/services/auth.js'),/schedule:\(callback,delay\)=>window\.setTimeout\(callback,delay\)/);
});
