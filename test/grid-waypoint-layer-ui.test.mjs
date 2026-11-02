import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const context=vm.createContext({window:{},document:{createElement:()=>({append(){},addEventListener(){},setAttribute(){},classList:{add(){}}})}});
vm.runInContext(readFileSync(new URL('../src/ui/grid-waypoint-layer.js',import.meta.url),'utf8'),context);
const render=context.window.DG_GRID_WAYPOINT_LAYER.render;
function leaflet(calls){const layer={addTo:target=>{calls.push(['layer-add',target]);return layer;}};return{layerGroup:()=>layer,control:()=>({onAdd(fn){this.callback=fn;},addTo(){this.element=this.onAdd();return this;},getContainer(){return this.element;}}),DomUtil:{create(tag,klass,parent){const n={textContent:'',classList:{toggle(){}},setAttribute(){},addEventListener(){},querySelector(){return null;}};if(parent)parent.button=n;return n;}},DomEvent:{disableClickPropagation(){},disableScrollPropagation(){}},divIcon:icon=>icon,marker:(point,style)=>({addTo(target){calls.push(['marker',point,style,target]);return this;},on(){return this;},bindTooltip(){return this;},dragging:{disable(){},enable(){}}})};}
test('replaces waypoint layer with numbered measurement-map markers',()=>{const calls=[],map={removeLayer:layer=>calls.push(['remove',layer])},previous={},rows=[{id:1,wp_id:1,lat:40.1,lon:32.2},{id:2,wp_id:2,lat:40.3,lon:32.4}],l=leaflet(calls);render({map,previousLayer:previous,rows,leaflet:l,editable:false,onSave:async()=>{}});assert.deepEqual(calls.map(c=>c[0]),['remove','layer-add','marker','marker']);assert.match(calls[2][2].icon.html,/<span>1<\/span>/);assert.deepEqual(JSON.parse(JSON.stringify(calls[2][1])),[40.1,32.2]);});
test('first waypoint layer works without a prior layer',()=>{const calls=[],map={removeLayer:()=>calls.push('remove')};render({map,previousLayer:null,rows:[],leaflet:leaflet(calls),editable:false,onSave:async()=>{}});assert.deepEqual(calls.map(c=>c[0]),['layer-add']);});




