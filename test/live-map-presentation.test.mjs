import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('live tree analytics clearly separates approved field data and collapses long species lists',()=>{
 const elements=new Map();
 const ctx=vm.createContext({
  $:id=>{if(!elements.has(id))elements.set(id,{innerHTML:''});return elements.get(id);},
  esc:s=>String(s),dgCf:s=>s,
  GROUP_COLOR:{'İBRELİ':'#14532d','YAPRAKLI':'#1e6f4b','DİĞER':'#64748b'},
  GROUP_COLOR_INK:{'İBRELİ':'#14532d','YAPRAKLI':'#1e6f4b'},
  LATIN:{'KARAÇAM':'Pinus nigra'},
 });
 vm.runInContext(read('src/services/dash.js'),ctx);
 ctx.renderAnalysis([
  {grp:'İBRELİ',species:'KARAÇAM',dbh_cm:20,height_m:8},
  {grp:'YAPRAKLI',species:'SÖĞÜT',dbh_cm:30,height_m:10},
 ],'liveAnalysis');
 const html=elements.get('liveAnalysis').innerHTML;
 assert.match(html,/dg-live-tree-card/);
 assert.match(html,/ONAYLI SAHA VERİSİ/);
 assert.match(html,/Ağaç Çeşitliliği & Yapısal Analiz/);
 assert.match(html,/Ort\. Çap/);
 assert.match(html,/En Yaygın 6 Tür/);
 assert.match(html,/<details class="dg-live-species">/);
 assert.doesNotMatch(html,/<details class="dg-live-species"[^>]*open/);
});

test('live map control groups and review cards use the existing theme and mobile layout',()=>{
 const shell=read('partials/shell.html'),css=read('css/park-panel.css');
 assert.match(shell,/class="live-map-tools dg-live-map-controls"/);
 assert.match(shell,/class="dg-live-map-refresh"/);
 assert.match(shell,/id="liveAnalysis" class="dg-live-analysis-stack"/);
 assert.match(css,/\.dg-live-surface-card\{display:grid;gap:12px/);
 assert.match(css,/\.dg-live-result-badge\.is-preview/);
 assert.match(css,/\.dg-live-result-badge\.is-saved/);
 assert.match(css,/\.dg-live-tree-metrics\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(css,/@media\(max-width:640px\)[\s\S]*?#lcSens \.dg-live-review-actions\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/);
 assert.match(css,/@media\(max-width:640px\)\{[\s\S]*?#v-map #map\.surface-review-map\{[\s\S]*?position:relative!important[\s\S]*?height:min\(64svh,580px\)!important/);
 assert.match(css,/@media\(max-width:640px\)\{[\s\S]*?#surfaceMenuBar\{[\s\S]*?grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
 assert.match(css,/@media\(max-width:640px\)\{[\s\S]*?#surfaceMenuBar>\.dg-editor-menu:not\(:nth-of-type\(3n\+1\)\)>\.dg-editor-menu-body\{left:auto;right:0\}/);
 assert.match(css,/\.dg-live-surface-head\{display:grid;grid-template-columns:minmax\(0,1fr\) auto/);
 assert.match(css,/\.dg-live-surface-head>\.dg-png-btn\{flex:0 0 auto;width:auto;min-width:112px/);
 assert.match(css,/@media\(max-width:640px\) and \(max-height:520px\)\{[\s\S]*?height:48svh!important/);
 assert.match(css,/var\(--surface\)/);
});


test('GIS editor keeps PNG export in the toolbar and standardizes opened panels',()=>{
 const surface=read('src/ui/lc-sens.js'),park=read('src/ui/park-panel.js'),css=read('css/park-panel.css');
 assert.match(surface,/data-editor-action="png-export"/);
 assert.match(surface,/dataset\.menuOrder="15"/);
 assert.doesNotMatch(surface,/onclick="dgSensExportPng\(\)"/);
 assert.match(park,/controls\.classList\?\.add\?\.\("dg-editor-menu-controls"\)/);
 assert.match(park,/controls\.querySelector\?\.\("\.dg-png-head"\)\?\.remove\?\.\(\)/);
 assert.match(park,/Number\.isFinite\(n\)/);
 assert.match(css,/#surfaceMenuBar \.dg-editor-menu-body\{display:grid;align-content:start;gap:10px\}/);
 assert.match(css,/\.dg-editor-menu-controls\{display:grid;gap:12px/);
});
