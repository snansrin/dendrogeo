import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../src/ui/park-measurement-gate.js',import.meta.url),'utf8');

test('measurement park gate delegates scan/change/admin actions from its container',()=>{
 const listeners={},calls=[],box={style:{},addEventListener:(name,handler)=>{listeners[name]=handler;},contains:()=>true};
 const window={};vm.runInContext(source,vm.createContext({window}));
 const actions={scan:options=>calls.push(['scan',options]),admin:()=>calls.push(['admin'])};
 const render=(status,project={id:8,name:'Park',park_name:'Park'})=>window.DG_PARK_MEASUREMENT_GATE_UI.render({result:{status,allowed:status==='editing',project,parkName:'Park',areaM2:100,isAdmin:true},box,save:{},escape:String,formatArea:()=> '100 m²',schemaWarningHTML:()=>'',actions});
 render('project-required');
 assert.match(box.innerHTML,/data-park-gate-action="scan"/);
 render('park-required');
 assert.match(box.innerHTML,/data-park-gate-action="admin"/);
 render('linked');
 assert.match(box.innerHTML,/data-park-gate-action="change" data-project-id="8"/);
 assert.doesNotMatch(box.innerHTML,/\bonclick\s*=/i);
 for(const [action,projectId] of [['scan',undefined],['admin',undefined],['change','8']]){
  const button={dataset:{parkGateAction:action,projectId},};
  listeners.click({target:{closest:selector=>selector==='[data-park-gate-action]'?button:null}});
 }
 assert.deepEqual(JSON.parse(JSON.stringify(calls)),[['scan',{returnTo:'measure'}],['admin'],['scan',{projectId:8,returnTo:'measure'}]]);
});
