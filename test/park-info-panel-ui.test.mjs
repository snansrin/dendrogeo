import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const context=vm.createContext({window:{}});
vm.runInContext(readFileSync(new URL('../src/ui/park-info-panel.js',import.meta.url),'utf8'),context);
const render=context.window.DG_PARK_INFO_PANEL_UI.render;

test('park panel keeps identity, hectares, selector and project markup in their existing positions',()=>{
 const html=render({name:'Göksu & Park',escape:s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'),hectares:'15.4',parkIdChip:'<span id="park-id">#8</span>',registerRetryMarkup:'',alternateSelector:'<select id="parkAlt"></select>',projectOptionsMarkup:'<option value="p">Proje</option>'});
 assert.ok(html.indexOf('Göksu &amp; Park')<html.indexOf('15.4 ha'));
 assert.ok(html.indexOf('<span id="park-id">#8</span>')<html.indexOf('<select id="parkAlt">'));
 assert.ok(html.indexOf('<select id="gridProject"')<html.indexOf('<option value="p">Proje</option>'));
 for(const id of ['parkGridTools','parkSurfaceAction','parkLayerTools','landCoverReport','lcSens','gridSummary'])assert.ok(html.includes(`id="${id}"`),`missing ${id}`);
 for(const handler of ['buildGrid()','runLandCoverAnalysis()','clearGrid()'])assert.ok(html.includes(`onclick="${handler}"`),`missing ${handler}`);
 assert.doesNotMatch(html,/parkRasterExport|pngBg|chkPngGrid|downloadParkImage/);
 for(const handler of ['toggleGridVis()','toggleWpVis()'])assert.ok(html.includes(`onchange="${handler}"`),`missing ${handler}`);
});

test('park panel keeps the registration retry slot optional and the menu control IDs stable',()=>{
 const html=render({name:'Park',escape:String,hectares:'1.0',parkIdChip:'',registerRetryMarkup:'<button id="retry">Retry</button>',alternateSelector:'',projectOptionsMarkup:''});
 assert.ok(html.includes('<button id="retry">Retry</button>'));
 assert.ok(html.includes('id="refHa"'));
 assert.ok(html.includes('id="chkGreenOnly"'));
 assert.ok(html.includes('id="gridClearance"'));
 assert.ok(!html.includes('id="pngBg"'));
});
