import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

class Element {
 constructor(tag='div'){this.tag=tag;this.children=[];this.listeners={};this.attributes={};this.dataset={};this.open=false;this.removed=false;this.focused=false;}
 append(...nodes){for(const node of nodes){if(node.parentNode)node.parentNode.children=node.parentNode.children.filter(child=>child!==node);this.children.push(node);node.parentNode=this;}}
 replaceChildren(){for(const node of this.children)node.parentNode=null;this.children=[];}
 setAttribute(name,value){this.attributes[name]=value;if(name.startsWith('data-'))this.dataset[name.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=value;}
 addEventListener(name,fn){this.listeners[name]=fn;}
 querySelectorAll(selector){
  if(selector==='details[open]')return this.children.filter(x=>x.tag==='details'&&x.open);
  if(selector==='.dg-editor-menu')return this.children.filter(x=>x.className==='dg-editor-menu');
  if(selector.startsWith('[data-menu-owner=')){const owner=selector.match(/"([^"]+)"/)?.[1];return this.children.filter(x=>x.dataset.menuOwner===owner);}
  return [];
 }
 remove(){this.removed=true;}
 focus(){this.focused=true;}
}
const source=readFileSync(new URL('../src/ui/park-menu-ui.js',import.meta.url),'utf8');
const context=vm.createContext({window:{}});vm.runInContext(source,context);
const ui=context.window.DG_PARK_MENU_UI;

test('park menus move the original controls, retain handlers, and keep park menu order',()=>{
 const nodes=Object.fromEntries(['surfaceParkTools','parkGridTools','parkLayerTools','gridSummary'].map(id=>[id,new Element(id)]));
 nodes.parkGridTools.value='selected-project';const handler=()=>{};nodes.parkLayerTools.onchange=handler;
 const calls=[];const doc={getElementById:id=>nodes[id]||null,createElement:tag=>new Element(tag)};
 ui.mount({document:doc,clearMenus:owner=>calls.push(['clear',owner]),arrangeMenus:()=>calls.push(['arrange']),translate:s=>'tr:'+s,escape:s=>'safe:'+s,editorUi:{menuLabel:(icon,title)=>icon+':'+title,panelHead:(icon,title,subtitle)=>[icon,title,subtitle].join('|')}});
 const nav=nodes.surfaceParkTools.children[0];assert.equal(nav.children.length,2);assert.equal(nav.attributes['aria-label'],'tr:Harita menüsü');
 assert.equal(nav.children[0].children[1].children[0],nodes.parkGridTools);assert.equal(nav.children[1].children[1].children[0],nodes.parkLayerTools);assert.equal(nav.children[0].children[1].children[1],nodes.gridSummary);
 assert.equal(nodes.parkGridTools.value,'selected-project');assert.equal(nodes.parkLayerTools.onchange,handler);assert.deepEqual(calls,[['clear','park'],['arrange']]);
 nav.children[1].open=true;nav.children[0].open=true;nav.children[0].listeners.toggle();assert.equal(nav.children[1].open,false);
});

test('shared menu bar sorts controls and clear removes only the requested owner',()=>{
 const menus=[70,30,10,60,20,40,50].map(menuOrder=>{const e=new Element('details');e.dataset.menuOrder=String(menuOrder);return e;});
 const bar=new Element('bar');bar.children=[...menus];const parks=new Element();parks.children=menus.filter(x=>[30,40].includes(Number(x.dataset.menuOrder)));parks.querySelectorAll=()=>menus.filter(x=>[30,40].includes(Number(x.dataset.menuOrder)));
 const brushes=new Element();brushes.querySelectorAll=()=>menus.filter(x=>![30,40].includes(Number(x.dataset.menuOrder)));
 const doc={getElementById:id=>({surfaceMenuBar:bar,surfaceParkTools:parks,surfaceBrushTools:brushes}[id]||null)};
 ui.arrange({document:doc});assert.deepEqual(bar.children.map(x=>Number(x.dataset.menuOrder)),[10,20,30,40,50,60,70]);
 const park=new Element();park.dataset.menuOwner='park';const surface=new Element();surface.dataset.menuOwner='surface';bar.children.push(park,surface);
 ui.clear({document:doc,owner:'park'});assert.equal(park.removed,true);assert.equal(surface.removed,false);
});

test('outside pointer and Escape close open menus, returning focus on Escape',()=>{
 const listeners={};const summary=new Element('summary');const menu=new Element('details');menu.open=true;menu.querySelector=()=>summary;
 const doc={addEventListener:(name,fn)=>{listeners[name]=fn;},querySelectorAll:()=>[menu]};ui.bindDismissal(doc);
 listeners.pointerdown({target:{closest:()=>null}});assert.equal(menu.open,false);
 menu.open=true;listeners.keydown({key:'Escape'});assert.equal(menu.open,false);assert.equal(summary.focused,true);
 menu.open=true;listeners.keydown({key:'Enter'});assert.equal(menu.open,true);
});

test('park panel keeps the legacy menu entry points as wrappers around the extracted module',()=>{
 const panel=readFileSync(new URL('../src/ui/park-panel.js',import.meta.url),'utf8');
 assert.match(panel,/function dgParkMountMenus\(\)[\s\S]*?DG_PARK_MENU_UI\.mount/);
 assert.match(panel,/function dgEditorClearMenus\(owner\)[\s\S]*?DG_PARK_MENU_UI\.clear/);
 assert.match(panel,/function dgEditorArrangeMenus\(\)[\s\S]*?DG_PARK_MENU_UI\.arrange/);
});

test('park menus mount after park markup and remain absent from reference edits',()=>{
 const panel=readFileSync(new URL('../src/ui/park-panel.js',import.meta.url),'utf8');
 const infoPanel=readFileSync(new URL('../src/ui/park-info-panel.js',import.meta.url),'utf8');
 const reference=panel.slice(panel.indexOf('function setRefHa'),panel.indexOf('function renderRefBadge'));
 assert.doesNotMatch(reference,/dgParkMountMenus/);
 assert.match(infoPanel,/id="gridSummary"/);
 assert.match(panel,/DG_PARK_INFO_PANEL_UI\.render\([\s\S]*?dgParkMountMenus\(\);[\s\S]*?renderRefBadge\(\);/);
});
