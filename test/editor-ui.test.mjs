import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/ui/editor-ui.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../css/park-panel.css',import.meta.url),'utf8');

test('shared map-editor components expose one accessible line-icon and panel pattern',()=>{
 const engineState={revision:'locked',analysis:Symbol('unchanged')},window={DG_SENS:engineState};
 vm.runInNewContext(source,{window});
 assert.equal(window.DG_SENS,engineState,'presentation helpers must not mutate GIS engine state');
 assert.deepEqual(Object.keys(window.DG_EDITOR_UI).sort(),['icon','menuLabel','panelHead']);
 const label=window.DG_EDITOR_UI.menuLabel('layers','Katmanlar');
 assert.match(label,/class="dg-editor-menu-icon"/);assert.match(label,/class="dg-editor-menu-label">Katmanlar/);assert.match(label,/class="dg-editor-menu-chevron"/);assert.match(label,/aria-hidden="true"/);
 const head=window.DG_EDITOR_UI.panelHead('grid','Grid ve waypoint','Saha araçları');
 assert.match(head,/class="dg-editor-panel-head"/);assert.match(head,/<strong>Grid ve waypoint<\/strong>/);assert.match(head,/<small>Saha araçları<\/small>/);
});

test('shared menu cards align to their control and collapse cleanly on phone widths',()=>{
 assert.match(css,/#surfaceMenuBar>\.dg-editor-menu\{position:relative/);
 assert.match(css,/\.dg-editor-menu-body\{[^}]*max-height:min\(58vh,520px\)/);
 assert.match(css,/data-menu-order="70"\]>.dg-editor-menu-body\{left:auto;right:0\}/);
 assert.match(css,/@media\(max-width:640px\)[^\n]*#surfaceMenuBar \.dg-editor-action-grid\{grid-template-columns:1fr\}/);
 assert.match(css,/\.dg-editor-tool \.dg-editor-icon\{width:20px;height:20px/);
});
