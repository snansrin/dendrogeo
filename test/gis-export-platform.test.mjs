import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const load=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const window={};vm.runInNewContext(load('src/ui/gis-export-platform.js'),{window});
const factory=window.DG_GIS_EXPORT_PLATFORM;
test('options read current controls with checked-by-default missing controls',()=>{
 const nodes={};const api=factory.create({document:{getElementById:id=>nodes[id]},getToast:()=>null});
 assert.deepEqual({...api.options()},{cover:true,grid:true,wp:true});
 nodes.chkPngCover={checked:false};nodes.chkPngGrid={checked:true};nodes.chkPngWp={checked:false};
 assert.deepEqual({...api.options()},{cover:false,grid:true,wp:false});
 nodes.chkPngGrid.checked=false;assert.equal(api.options().grid,false);
 assert.equal(api.read('chkPngGrid'),nodes.chkPngGrid);
});
test('canvas size is applied before obtaining context and unsupported context stays null',()=>{
 const context={},seen=[];let supported=true;
 const api=factory.create({getToast:()=>null,document:{createElement:tag=>{assert.equal(tag,'canvas');return {getContext(type){seen.push([type,this.width,this.height]);return supported?context:null;}};}}});
 const result=api.canvas(1240,1560);assert.equal(result.context,context);
 assert.deepEqual(seen,[['2d',1240,1560]]);
 supported=false;assert.equal(api.canvas(1200,900).context,null);
});
test('notice resolves a late-loaded toast and preserves type and icon',()=>{
 let toast;const calls=[];const api=factory.create({document:{},getToast:()=>toast});
 api.notify('before');toast=(...args)=>calls.push(args);
 api.notify('ready');api.notify('failed','err');
 assert.deepEqual(calls,[['ready','info','🖼️'],['failed','err','🖼️']]);
});
test('browser adapter loads before GIS export and is available offline',()=>{
 const html=load('index.html');assert.ok(html.indexOf('src/ui/gis-export-platform.js')<html.indexOf('src/ui/gis-export.js'));
 assert.match(html,/src\/ui\/gis-export-platform\.js\?v=[a-f0-9]{8}/);
 assert.match(load('sw.js'),/\/src\/ui\/gis-export-platform\.js/);
});
