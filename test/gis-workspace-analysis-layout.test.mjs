import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/ui/gis-workspace-analysis-layout.js',import.meta.url),'utf8');

test('analysis layout decorates the existing group summary without replacing its node',()=>{
 const classes=[];
 const summary={tagName:'DIV',classList:{add:name=>classes.push(name)}};
 const heading={textContent:'Grup Dağılımı',nextElementSibling:summary};
 const unrelated={textContent:'Başka alan',nextElementSibling:{tagName:'DIV',classList:{add:()=>{throw Error('unrelated card must not change');}}}};
 const host={querySelectorAll:selector=>selector==='.card .lbl'?[heading,unrelated]:[]};
 const context=vm.createContext({window:{}});
 vm.runInContext(source,context);
 const layout=context.window.DG_GIS_WORKSPACE_ANALYSIS_LAYOUT.create({getElement:id=>id==='liveAnalysis'?host:null,el:()=>{throw Error('no nodes should be created');}});
 layout.syncGroupLayout();
 assert.deepEqual(classes,['dg-ux-group-summary']);
 assert.equal(heading.nextElementSibling,summary);
 assert.equal(typeof layout.syncSpecies,'function');
});
