import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
function setup(){
 const images=[],draws=[],completed=[],timers=new Map(),events={};let nextTimer=0;
 const document={createElement:type=>type==='canvas'?{dataset:{},getContext:()=>({drawImage:(...args)=>draws.push(args)})}:(()=>{const image={naturalWidth:256,naturalHeight:256,removeAttribute:()=>{}};images.push(image);return image;})()};
 const window={};vm.runInNewContext(readFileSync(new URL('../src/adapters/map/recover-imagery-tiles.js',import.meta.url),'utf8'),{window,Error});
 const layer={getTileSize:()=>({x:256,y:256}),on:(name,fn)=>events[name]=fn};
 window.DG_RECOVER_IMAGERY_TILES.install(layer,{document,url:'https://tiles.test/{z}/{y}/{x}',setTimeout:fn=>{timers.set(++nextTimer,fn);return nextTimer;},clearTimeout:id=>timers.delete(id)});
 const tile=layer.createTile({z:19,x:101,y:103},(...args)=>completed.push(args));
 return{images,draws,completed,timers,events,tile};
}
test('available imagery retains its native pixels and completes once',()=>{
 const s=setup();assert.equal(s.images[0].src,'https://tiles.test/19/103/101?blankTile=false');
 s.images[0].onload();assert.deepEqual(s.draws[0].slice(1),[0,0,256,256,0,0,256,256]);
 assert.equal(s.tile.dataset.dgImageryZoom,'19');assert.equal(s.completed.length,1);assert.equal(s.timers.size,0);
});
test('missing imagery crops the correct parent quadrant and keeps the requested geographic extent',()=>{
 const s=setup();s.images[0].onerror();assert.equal(s.images[1].src,'https://tiles.test/18/51/50?blankTile=false');
 s.images[1].onload();assert.deepEqual(s.draws[0].slice(1),[128,128,128,128,0,0,256,256]);
 assert.equal(s.tile.dataset.dgImageryZoom,'18');assert.equal(s.completed[0][0],null);
});
test('recovery is bounded and never declares unavailable imagery loaded',()=>{
 const s=setup();for(let i=0;i<5;i++)s.images[i].onerror();
 assert.equal(s.images.length,5);assert.equal(s.draws.length,0);assert.equal(s.completed.length,1);assert.ok(s.completed[0][0] instanceof Error);
});
test('panning away cancels requests, deadlines and late image callbacks',()=>{
 const s=setup(),late=s.images[0].onload;s.events.tileunload({tile:s.tile});late();
 assert.equal(s.draws.length,0);assert.equal(s.completed.length,0);assert.equal(s.timers.size,0);
});
test('satellite layer installs recovery before adding to the map and loads it before the adapter',()=>{
 const events=[],layer={addTo:()=>events.push('add')},window={document:{},setTimeout(){},clearTimeout(){},DG_RECOVER_IMAGERY_TILES:{install:target=>{assert.equal(target,layer);events.push('recover');}}};
 vm.runInNewContext(readFileSync(new URL('../src/adapters/map/create-base-map-layer.js',import.meta.url),'utf8'),{window});
 window.DG_CREATE_BASE_MAP_LAYER.create({leaflet:{tileLayer:()=>layer},map:{},configuration:{type:'sat',url:'tiles'}});
 assert.deepEqual(events,['recover','add']);
 const head=readFileSync(new URL('../partials/head.html',import.meta.url),'utf8'),sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 assert.ok(head.indexOf('src/adapters/map/recover-imagery-tiles.js')<head.indexOf('src/adapters/map/create-base-map-layer.js'));
 assert.ok(sw.includes('/src/adapters/map/recover-imagery-tiles.js'));
});
