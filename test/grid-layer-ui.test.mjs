import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const context=vm.createContext({window:{}});
vm.runInContext(readFileSync(new URL('../src/ui/grid-layer.js',import.meta.url),'utf8'),context);
const render=context.window.DG_GRID_LAYER_UI.render;
function setup(cells){
 const removed=[],polygons=[],clicked=[],summaries=[],events=[];let created;
 const map={removeLayer:x=>removed.push(x)};
 const layer={addTo:x=>{assert.strictEqual(x,map);return layer;}};
 const renderer={kind:'canvas'};
 const leaflet={layerGroup:()=>layer,canvas:options=>{assert.equal(options.padding,.1);return renderer;},polygon:(shape,options)=>{const rect={shape,options,addTo:x=>{assert.strictEqual(x,layer);return rect;},on:(event,fn)=>{assert.equal(event,'click');rect.click=fn;},bindTooltip:(text,options)=>{rect.tooltip=text;assert.equal(options.sticky,true);}};polygons.push(rect);return rect;},DomEvent:{stopPropagation:event=>events.push(event)}};
 const previousLayer={},previousRenderer={};
 render({leaflet,map,previousLayer,previousRenderer,cells,selection:new Set(['b']),resolveStyle:(cell,active)=>({color:active?'blue':'green'}),resolveShape:cell=>cell.shape,countStates:rows=>({measured:rows.filter(x=>x.n).length,empty:rows.filter(x=>!x.n).length}),translateFormat:(s,v)=>`${v.id}:${v.n}`,onSelect:(...x)=>clicked.push(x),onCreated:x=>{created=x;},updateSummary:(...x)=>summaries.push(x)});
 return{removed,polygons,clicked,summaries,events,created,layer,renderer,previousLayer,previousRenderer};
}
test('grid drawing preserves shapes and routes clicks to the matching cell without map propagation',()=>{
 const cells=[{id:'a',n:1,shape:[[1,2],[3,4]]},{id:'b',n:0,shape:[[5,6],[7,8]]}];const x=setup(cells);
 assert.deepEqual(x.removed,[x.previousLayer,x.previousRenderer]);assert.strictEqual(x.created.layer,x.layer);assert.strictEqual(x.created.renderer,x.renderer);assert.deepEqual(x.summaries,[[1,1]]);
 x.polygons.forEach((p,i)=>{assert.strictEqual(p.shape,cells[i].shape);assert.equal(p._cellId,cells[i].id);assert.strictEqual(p.options.renderer,x.renderer);assert.equal(p.options.interactive,true);});assert.equal(x.polygons[1].options.color,'blue');assert.equal(x.polygons[1].tooltip,'b:0');const event={};x.polygons[1].click(event);assert.deepEqual(x.events,[event]);assert.deepEqual(x.clicked,[['b',x.polygons[1]]]);
});
test('empty grid replaces old layers and clears summary counts without creating polygons',()=>{
 const x=setup([]);assert.equal(x.removed.length,2);assert.equal(x.polygons.length,0);assert.deepEqual(x.summaries,[[0,0]]);
});
