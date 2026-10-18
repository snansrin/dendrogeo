import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../src/ui/gis-workspace-menu-position.js',import.meta.url),'utf8');
function panel(scrollHeight=200){return {scrollHeight,style:{}};}
function menu(panelNode,{left=100,top=60,bottom=100,open=true}={}){
 return {open,style:{},querySelector:()=>panelNode,getBoundingClientRect:()=>({left,top,bottom})};
}
function position(windowRef){
 const context={window:windowRef};
 vm.runInNewContext(source,context);
 return context.window.DG_GIS_WORKSPACE_MENU_POSITION.create({windowRef}).position;
}

test('mobile menu panel remains attached to its trigger and fits the visible viewport',()=>{
 const windowRef={innerWidth:390,innerHeight:844,visualViewport:{width:390,height:844,offsetTop:0,offsetLeft:0}};
 const panelNode=panel(300),place=position(windowRef),trigger=menu(panelNode,{bottom:70});
 place(trigger);
 assert.deepEqual({...panelNode.style},{position:'absolute',left:'-88px',right:'auto',width:'366px',top:'calc(100% + 6px)',bottom:'auto',maxHeight:'300px'});
 assert.equal(trigger.style.position,'relative');
});

test('phone menus use the visible width and offsets when the viewport is zoomed',()=>{
 const panelNode=panel(300),place=position({innerWidth:390,innerHeight:844,visualViewport:{width:300,height:600,offsetTop:40,offsetLeft:15}});
 place(menu(panelNode,{bottom:70}));
 assert.equal(panelNode.style.position,'absolute');assert.equal(panelNode.style.left,'-73px');assert.equal(panelNode.style.width,'276px');
 assert.equal(panelNode.style.top,'calc(100% + 6px)');
 assert.ok(parseFloat(panelNode.style.maxHeight)<=558);
});

test('desktop menu near the lower edge opens above the edge',()=>{
 const windowRef={innerWidth:1280,innerHeight:720,visualViewport:null};
 const panelNode=panel(500),place=position(windowRef);
 place(menu(panelNode,{left:900,top:650,bottom:680}));
 assert.deepEqual({...panelNode.style},{position:'absolute',left:'-72px',right:'auto',width:'440px',top:'auto',bottom:'calc(100% + 6px)',maxHeight:'500px'});
});

test('desktop menu with room remains anchored below its summary',()=>{
 const windowRef={innerWidth:1280,innerHeight:720,visualViewport:null};
 const panelNode=panel(200),place=position(windowRef);
 place(menu(panelNode));
 assert.deepEqual({...panelNode.style},{position:'absolute',left:'0px',right:'auto',width:'440px',top:'calc(100% + 6px)',bottom:'auto',maxHeight:'200px'});
});

test('closed menus and missing panels are left untouched',()=>{
 const place=position({innerWidth:1280,innerHeight:720,visualViewport:null});
 const panelNode=panel();
 place(menu(panelNode,{open:false}));
 place({open:true,querySelector:()=>null});
 assert.deepEqual({...panelNode.style},{});
});
