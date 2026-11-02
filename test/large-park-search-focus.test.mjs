import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
test('park fits immediately while coverage remains pending',async()=>{
 const w={};vm.runInNewContext(readFileSync('src/application/parks/draw-selected-park.js','utf8'),{window:w});let release;const calls=[],outer=[[[51,-.2],[51.1,-.2],[51,-.1],[51,-.2]]];
 const pending=w.DG_DRAW_SELECTED_PARK.draw({}, {setSelectedArea(){},clearPark(){},clearGrid(){},registerPark:async()=>({id:1}),normalize:()=>({outer,holes:[]}),setGeometry(){},renderBoundary(){calls.push('boundary')},fitBoundary(){calls.push('fit')},loadCoverage:()=>new Promise(r=>release=r),isCurrent:()=>true,areaHa:()=>142,present(){calls.push('present')},coverageUnavailable(){calls.push('unavailable')}});
 assert.deepEqual(calls,['boundary','fit']);release(false);await pending;assert.deepEqual(calls,['boundary','fit','unavailable','present']);
});
test('registered and remote name results focus before remote detection',async()=>{
 const w={};vm.runInNewContext(readFileSync('src/ui/park-search-result.js','utf8'),{window:w});const calls=[],ports={toast(){},escape:x=>x,translate:x=>x,translateCommon:x=>x,selectPark(){},renderCard(){},focusPoint:(a,b)=>calls.push(['focus',a,b]),detectAt:async()=>calls.push(['detect'])};
 await w.DG_PRESENT_PARK_SEARCH_RESULT.present({status:'registered',park:{name:'Hyde Park',centroid_lat:51.5,centroid_lon:-.16}},ports);assert.deepEqual(calls,[['focus',51.5,-.16]]);calls.length=0;
 await w.DG_PRESENT_PARK_SEARCH_RESULT.present({status:'geocoded',point:{lat:51.5,lon:-.16}},ports);assert.deepEqual(calls,[['focus',51.5,-.16],['detect']]);
});
