import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/services/grid-engine.js',import.meta.url),'utf8');
test('grid is blocked only while the single analysis is active and draft changes invalidate its source',async()=>{
 const messages=[],state={epoch:1,partitionVersion:1,visualVersion:1,record:{sens:{green:50},autoClassify:true}};
 const ctx=vm.createContext({window:{DG_GIS_PARK_ANALYSIS:{busy:true},DG_LC_SENS:{state}},toast:(...a)=>messages.push(a),PARK_POLY:[],dgCf:s=>s});
 vm.runInContext(source,ctx);
 await vm.runInContext('buildGrid()',ctx);
 assert.match(messages[0][0],/Park analizinin/);
 const before=vm.runInContext('dgGridReviewSignature()',ctx);
 state.visualVersion++;
 assert.notEqual(vm.runInContext('dgGridReviewSignature()',ctx),before);
 ctx.window.DG_GIS_PARK_ANALYSIS.busy=false;
 await vm.runInContext('buildGrid()',ctx);
 assert.match(messages.at(-1)[0],/Önce park seç/);
});
test('after the single analysis completes grid builds and its button is released; mid-flight edits reject stale grid',async()=>{
 const messages=[],nodes={gridBuildBtn:{isConnected:true,disabled:false},gridSize:{value:'20'},gridClearance:{value:'3'}};
 const record={sens:{green:50},autoClassify:true,features:[]};
 const state={epoch:1,partitionVersion:1,visualVersion:1,record,geometry:{},epsg:32636,parkGeometry:[]};
 const query={select(){return this;},eq(){return this;},gte(){return this;},lte(){return this;},limit:async()=>({data:[],count:0,error:null})};
 const ctx=vm.createContext({window:{DG_GIS_PARK_ANALYSIS:{busy:false},DG_LC_SENS:{state},DG_SURFACE_REVIEW:{resolved:()=>[{type:'green',geom:[]}]}},
  toast:(...a)=>messages.push(a),PARK_POLY:[[[39.95,32.65],[39.96,32.65],[39.96,32.66]]],PARK_HOLES:[],DG_GREEN_ONLY:true,
  DG_LC_LAST:{result:{cells:[{}]}},GRID_CELLS:[],SELECTED_CELLS:new Set(),GRID_LAYER:null,WP_AUTO_LAYER:null,map:{},
  WATER_LINES:[],IMP_LINES:[],GRID_BLOCK_LINES:[],sb:{from:()=>query},$:id=>nodes[id]||null,
  dgLcUtmEpsgForLatLon:()=>32636,dgSensCells:()=>[{}],dgSensEffective:()=> 'green',dgSensFeatures:()=>[],dgWarnIfTruncated(){},
  dgSurfaceWorkerJob:async()=>({cells:[{baseId:'0_0',id:'0_0',n:0}],areaM2:100}),
 });
 vm.runInContext(source,ctx);vm.runInContext('drawGridLayer=()=>{}',ctx);
 await vm.runInContext('buildGrid()',ctx);
 assert.equal(ctx.GRID_CELLS.length,1);
 assert.match(messages.at(-1)[0],/Grid hazır/);
 assert.equal(nodes.gridBuildBtn.disabled,false);
 ctx.dgSurfaceWorkerJob=async()=>{state.visualVersion++;return{cells:[{id:'stale'}],areaM2:100};};
 await vm.runInContext('buildGrid()',ctx);
 assert.match(messages.at(-1)[0],/Yüzey değişti/);
 assert.equal(ctx.GRID_CELLS[0].id,'0_0');
 assert.equal(nodes.gridBuildBtn.disabled,false);
});
