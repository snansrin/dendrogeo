import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
const read=path=>readFileSync(new URL('../'+path,import.meta.url)),hash=value=>createHash('sha256').update(value).digest('hex');
test('display scenes retain accepted areas, real NDVI and traceable production report sources',()=>{
 const source=read('assets/landing/goksu-example.json'),data=JSON.parse(source),scene=JSON.parse(read('assets/landing/goksu-scenes.json'));
 assert.equal(scene.sourceSha256,hash(source));assert.deepEqual(scene.areas,data.areas);assert.equal(scene.ndvi.count,data.ndvi.count);assert.deepEqual(scene.ndvi.cutoffs,data.ndvi.cutoffs);
 assert.deepEqual(scene.surface.map(f=>f.class),data.features.map(f=>f.properties.class));assert.ok(scene.surface.every(f=>/^M[\d.,LZM-]+$/.test(f.path)));assert.ok(scene.outline.startsWith('M'));
 for(const item of scene.reportSources)assert.equal(item.sha256,hash(read(item.path)));
});
test('spatial renderer only presents supplied geometry and clips temporary sketches',()=>{
 const root={};vm.runInNewContext(read('src/ui/render-landing-spatial-scene.js').toString(),{window:root});const data=JSON.parse(read('assets/landing/goksu-scenes.json'));
 const surface=root.DG_RENDER_LANDING_SPATIAL_SCENE.render({data,mode:'map',id:'test-map'}),ndvi=root.DG_RENDER_LANDING_SPATIAL_SCENE.render({data,mode:'ndvi',id:'test-ndvi'});
 assert.match(surface,/data-scene-class="building"/);assert.match(surface,/clip-path="url\(#test-map\)"/);assert.match(ndvi,/data-scene-class="dense"/);assert.doesNotMatch(ndvi,/data-scene-class="water"/);
});
test('brand navigation opens landing and returns to the existing app without restarting it',()=>{
 const listeners={},shell={style:{display:'block'}},landing={style:{display:'none'}},button={hidden:true};let prevented=0,entries=0;
 const document={addEventListener:(key,fn)=>{listeners[key]=fn;},getElementById:id=>id==='shell'?shell:landing,querySelector:()=>button};
 const root={scrollY:123,scrollTo:position=>{root.position=position;},initLanding:()=>{entries++;shell.style.display='none';landing.style.display='block';}};
 vm.runInNewContext(read('src/ui/landing-home-navigation.js').toString(),{window:root,document});
 const click=(selector,extra={})=>listeners.click({target:{closest:key=>key===selector?{}:null},preventDefault(){prevented++;},...extra});
 click('[data-dg-home]');assert.equal(entries,1);assert.equal(button.hidden,false);assert.equal(root.position.top,0);
 click('[data-dg-return-workspace]');assert.equal(entries,1);assert.equal(shell.style.display,'block');assert.equal(landing.style.display,'none');assert.equal(root.position.top,123);
 click('[data-dg-home]',{ctrlKey:true});assert.equal(entries,1);assert.equal(prevented,2);
});
test('report scene describes actual DGR sections instead of publishing a surface-only mock report',()=>{
 const landing=read('partials/landing.html').toString(),controller=read('src/ui/landing-scene-controller.js').toString();
 assert.match(landing,/data-report-pick="quality"/);assert.match(landing,/Monte Carlo belirsizliğini/);assert.doesNotMatch(landing,/goksu-report.jpg|view=report|<img[^>]+goksu-/);
 assert.match(controller,/7 · Kalite Kontrol ve Doğrulama/);assert.match(controller,/10 · Tekrar Üretilebilirlik/);assert.match(controller,/11 · Analiz Parmak İzi/);
 assert.doesNotMatch(controller,/sb\.|localStorage|sessionStorage|DG_LANDCOVER|DG_LC_S2/);
});

test('saved public surface is current while NDVI retains its original source context',()=>{
 const data=JSON.parse(read('assets/landing/goksu-example.json')),scene=JSON.parse(read('assets/landing/goksu-scenes.json'));
 assert.equal(data.source.acceptedAt,'2026-10-16T14:21:35.805Z');assert.equal(data.source.publicRpc,'dg_accepted_park_surface');assert.equal(data.source.snapshotSha256.length,64);
 assert.deepEqual(scene.areas,data.areas);assert.equal(data.areas.hard,140542.2600498222);assert.ok(data.displayFeatures.length===5);
 assert.equal(data.ndvi.surfaceContext.revision,26);assert.ok(data.ndvi.outer.length);assert.ok(scene.ndvi.outline);assert.notEqual(scene.ndvi.outline,scene.outline);
 const html=read('partials/landing.html').toString();assert.ok(html.indexOf('class="dg-tree-readouts"')<html.indexOf('class="walkerA"'));assert.match(html,/foreignObject/);
});
