import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/ui/park-panel.js',import.meta.url),'utf8');
class Element {
 constructor(){this.children=[];this.listeners={};this.open=false;}
 append(...nodes){this.children.push(...nodes);}
 replaceChildren(){this.children=[];}
 setAttribute(){}
 addEventListener(name,fn){this.listeners[name]=fn;}
 querySelectorAll(){return this.children.filter(x=>x.open);}
}
test('park menus move the original grid and layer nodes, retaining values and handlers',()=>{
 const nodes=Object.fromEntries(['surfaceParkTools','parkGridTools','parkLayerTools'].map(id=>[id,new Element()]));
 nodes.parkGridTools.value='selected-project';const handler=()=>{};nodes.parkLayerTools.onchange=handler;
 const ctx=vm.createContext({document:{getElementById:id=>nodes[id],createElement:()=>new Element()}});
 const start=source.indexOf('function dgParkMountMenus(){');const end=source.indexOf('\nif(typeof document.addEventListener',start);
 vm.runInContext(source.slice(start,end)+';dgParkMountMenus()',ctx);
 const nav=nodes.surfaceParkTools.children[0];assert.equal(nav.children.length,2);
 assert.equal(nav.children[0].children[1].children[0],nodes.parkGridTools);
 assert.equal(nav.children[1].children[1].children[0],nodes.parkLayerTools);
 assert.equal(nodes.parkGridTools.value,'selected-project');assert.equal(nodes.parkLayerTools.onchange,handler);
 nav.children[1].open=true;nav.children[0].open=true;nav.children[0].listeners.toggle();assert.equal(nav.children[1].open,false);
});
