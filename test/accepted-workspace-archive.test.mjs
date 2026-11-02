import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';
test('explicit acceptance archives the exact current project even before saved-project watching starts, once per revision',async()=>{
 const source=readFileSync(new URL('../src/bootstrap/live-map-project-workspace.js',import.meta.url),'utf8');
 const section=source.slice(source.indexOf(' const archivedAcceptances='),source.indexOf(' root.DG_LIVE_MAP_PROJECTS='));
 const saves=[],handlers={},park={id:53,geom_json:{outer:[[[39,32],[39,33],[40,32],[39,32]]]}},review={acceptedAt:'2026-11-02T12:00:00Z',features:[{type:'building',geometry:{outer:[[[39,32],[39,32.1],[39.1,32],[39,32]]]}}],acceptedResult:{displayFeatures:[{type:'building'}]}};
 const context={root:{DG_LIVE_MAP_PROJECTS:{activeProjectId:()=>0},addEventListener:(name,fn)=>handlers[name]=fn},document:{getElementById:()=>({value:'33'})},USER:{id:'owner'},PROJ_LIST:[{id:33,park_id:53}],DG_PARK:park,workspaceIdentity:null,watchWorkspace(){},saveWorkspace:async(projectId,savedPark,options)=>{saves.push({projectId,park:savedPark,options,review:structuredClone(review)});},console};
 vm.runInNewContext(section,context);
 const event={detail:{parkId:53,acceptedAt:review.acceptedAt}};handlers['dg:surface-accepted'](event);handlers['dg:surface-accepted'](event);await Promise.resolve();
 assert.equal(saves.length,1);assert.equal(saves[0].projectId,33);assert.equal(saves[0].options.flush,true);assert.deepEqual(saves[0].review,review);
 handlers['dg:surface-accepted']({detail:{parkId:99,acceptedAt:'later'}});assert.equal(saves.length,1);
 const ui=readFileSync(new URL('../src/ui/lc-sens.js',import.meta.url),'utf8');assert.match(ui,/then\(saved=>\{if\(saved\)window\.dispatchEvent\?\.\(new CustomEvent\("dg:surface-accepted"/);
});
test('later edits cannot mutate the accepted drawing snapshot while its account write awaits',async()=>{
 const root={};vm.runInNewContext(readFileSync(new URL('../src/ui/live-map-project-snapshot.js',import.meta.url),'utf8'),{window:root});
 let release,saved;const pending=new Promise(resolve=>{release=resolve;});
 const live={analysis:{report:{year:2021},result:{cells:[{classKey:'green'}]}},review:{acceptedAt:'accepted',features:[{type:'building',geometry:{outer:[[[39,32],[39,33],[40,32],[39,32]]]}}]}};
 const controller=root.DG_LIVE_MAP_PROJECT_SNAPSHOT.create({capture:()=>live,store:{async save(_scope,snapshot){await pending;saved=snapshot;}},apply:()=>{}});
 const expected=structuredClone(live),job=controller.save({ownerId:'owner',projectId:33,parkId:53,geometry:{outer:[[[39,32],[39,33],[40,32],[39,32]]]},engine:'engine'});
 live.review.features[0].geometry.outer[0][0][0]=99;live.analysis.result.cells[0].classKey='water';release();await job;
 assert.deepEqual(JSON.parse(JSON.stringify(saved.state)),expected);
});
