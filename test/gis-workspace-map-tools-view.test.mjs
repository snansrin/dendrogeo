import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../src/ui/gis-workspace-map-tools-view.js',import.meta.url),'utf8');
class Element{
 constructor(tag,cls='',text=''){
  this.tagName=tag.toUpperCase();this.className=cls;this.textContent=text;this.children=[];this.dataset={};this.attributes={};this.listeners={};this.classList={add:name=>{this.className+=(this.className?' ':'')+name;}};
 }
 append(...nodes){for(const node of nodes){node.parentElement=this;this.children.push(node);}}
 addEventListener(name,callback){this.listeners[name]=callback;}
 setAttribute(name,value){this.attributes[name]=value;}
 find(predicate){if(predicate(this))return this;for(const child of this.children){const found=child.find?.(predicate);if(found)return found;}return null;}
 querySelector(selector){
  if(selector==='#dgUxMapTools')return this.find(node=>node.id==='dgUxMapTools');
  const match=selector.match(/^button\[data-tool="([^"]+)"\]$/);
  if(match)return this.find(node=>node.tagName==='BUTTON'&&node.dataset.tool===match[1]);
  return null;
 }
}

test('map tools view creates the existing controls once and forwards their actions',()=>{
 const body=new Element('div','dg-editor-menu-body'),menu=new Element('details');
 menu.querySelector=selector=>selector==='.dg-editor-menu-body'?body:null;
 const bar=new Element('nav');bar.querySelector=selector=>selector==='details[data-menu-order="20"]'?menu:null;
 const calls={tools:[],close:0,status:[],focus:0,coordinate:0,copy:0};
 const context={window:{}};vm.runInNewContext(source,context);
 const view=context.window.DG_GIS_WORKSPACE_MAP_TOOLS_VIEW.create({
  getElement:id=>id==='surfaceMenuBar'?bar:null,
  el:(tag,cls,text)=>new Element(tag,cls,text),
  getMapTool:()=> 'distance',
  activateTool:mode=>calls.tools.push(mode),
  closeTool:()=>calls.close++,
  setStatus:value=>calls.status.push(value),
  focusPark:()=>calls.focus++,
  coordinateQuery:()=>calls.coordinate++,
  copyCoordinate:()=>calls.copy++
 });
 view.sync();view.sync();
 const sections=body.children.filter(node=>node.id==='dgUxMapTools');
 assert.equal(sections.length,1);
 const section=sections[0],nav=section.children[1],distance=nav.children[0],area=nav.children[1];
 assert.equal(section.children[0].textContent,'HARİTA ÖLÇÜM VE İNCELEME');
 assert.deepEqual({...distance.attributes},{'aria-pressed':'true'});
 assert.ok(distance.className.includes('is-active'));
 distance.listeners.click();area.listeners.click();nav.children[2].listeners.click();nav.children[3].listeners.click();
 const row=section.children[3],input=row.children[0];
 let prevented=false;input.listeners.keydown({key:'Enter',preventDefault(){prevented=true;}});
 row.children[1].listeners.click();row.children[2].listeners.click();
 assert.deepEqual(calls,{tools:['distance','area'],close:1,status:['Geçici ölçüm kaldırıldı.'],focus:1,coordinate:2,copy:1});
 assert.equal(prevented,true);
 assert.equal(input.id,'dgUxCoordInput');
 assert.equal(input.inputMode,'decimal');
 assert.equal(section.children[2].htmlFor,'dgUxCoordInput');
 assert.equal(section.children[4].attributes.role,'status');
});

test('map tools view does nothing when the existing menu is unavailable',()=>{
 const context={window:{}};vm.runInNewContext(source,context);
 const view=context.window.DG_GIS_WORKSPACE_MAP_TOOLS_VIEW.create({getElement:()=>null,el:()=>{throw Error('unexpected render');}});
 assert.doesNotThrow(()=>view.sync());
});
