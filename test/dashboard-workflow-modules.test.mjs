import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const files=[
 'src/application/dashboard/load-own-records.js',
 'src/application/dashboard/delete-own-record.js',
 'src/application/dashboard/load-owner-dashboard.js',
 'src/ui/dashboard-chart.js',
 'src/application/dashboard/load-world-dashboard.js'
];
function load(){
 const window={},context=vm.createContext({window,Promise,Object,Array,Number});
 for(const file of files)vm.runInContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),context);
 return window;
}

test('own record view loads and groups before rendering with the established empty state',async()=>{
 const api=load().DG_LOAD_OWN_RECORDS_VIEW,events=[],data=[{id:1}];
 await api.execute('u',{load:async id=>{events.push(['load',id]);return{data};},group:rows=>{events.push(['group',rows]);return new Map([['Project',[{id:1}]]]);},container:()=>({innerHTML:''}),renderGroup:(name,rows)=>`<section>${name}:${rows.length}</section>`,empty:()=>'<empty>'});
 assert.equal(events[0][0],'load');assert.equal(events[1][0],'group');
 const box={innerHTML:''};await api.execute('u',{load:async()=>({data:[]}),group:()=>new Map(),container:()=>box,renderGroup:()=>'',empty:()=>'<empty>'});assert.equal(box.innerHTML,'<empty>');
 let read=false;await api.execute('u',{load:async()=>{read=true;return{data:[]};},group:()=>new Map(),container:()=>null,renderGroup:()=>'',empty:()=>''});assert.equal(read,true);
});

test('own record deletion requires confirmation and server proof before photo cleanup',async()=>{
 const api=load().DG_DELETE_OWN_RECORD,events=[];
 await api.execute(7,{confirm:()=>false,remove:()=>assert.fail('must not delete'),onFailure(){},removePhoto(){}});
 await api.execute(7,{confirm:()=>true,remove:async()=>({data:[],error:null}),onFailure:()=>events.push('error'),removePhoto:()=>events.push('photo')});assert.deepEqual(events,['error']);
 await api.execute(7,{confirm:()=>true,remove:async()=>({data:[{photo_url:'p1'},{photo_url:null}],error:null}),removePhoto:url=>events.push(['photo',url]),refreshRecords:()=>events.push('records'),refreshDashboard:()=>events.push('dashboard'),markLiveDirty:()=>events.push('dirty'),shouldRefreshMap:()=>true,refreshMap:()=>events.push('map')});
 assert.deepEqual(events.slice(1),[['photo','p1'],'records','dashboard','dirty','map']);
});

test('owner dashboard loads after profile render and preserves count, carbon and first-ten chart inputs',async()=>{
 const api=load().DG_LOAD_OWNER_DASHBOARD,events=[],rows=Array.from({length:12},(_,index)=>({point_id:index+1,carbon_kg:index+2}));
 await api.execute('u',{renderProfile:()=>events.push('profile'),load:async id=>{events.push(['load',id]);return{data:rows};},update:value=>events.push(['update',value]),renderChart:(labels,data)=>events.push(['chart',labels,data]),renderAnalysis:(data,id)=>events.push(['analysis',data,id])});
 assert.equal(events[0],'profile');assert.deepEqual(events[1],['load','u']);assert.deepEqual(JSON.parse(JSON.stringify(events[2])),['update',{records:12,carbon:'90'}]);
 assert.deepEqual(JSON.parse(JSON.stringify(events[3])),['chart',Array.from({length:10},(_,i)=>'P'+(i+1)),Array.from({length:10},(_,i)=>i+2)]);assert.equal(events[4][2],'myAnalysis');
});

test('dashboard chart waits for lazy library, destroys the previous chart and keeps chart options',async()=>{
 const api=load().DG_DASHBOARD_CHART,events=[],charts={x:{destroy:()=>events.push('destroy')}},created=[];
 class Chart{constructor(element,options){this.element=element;this.options=options;created.push(this);}}
 await api.render('x','bar',['P1'],[4],{ensure:async()=>events.push('ensure'),charts,Chart,element:id=>({id})});
 assert.deepEqual(events,['ensure','destroy']);assert.equal(created[0].element.id,'x');assert.deepEqual(Array.from(created[0].options.data.labels),['P1']);
 assert.equal(created[0].options.data.datasets[0].backgroundColor({dataIndex:0}),'#14532d');assert.equal(created[0].options.options.scales.y.ticks.color,'#5f6d65');
});

test('dashboard chart resolves the global only after lazy loading completes',async()=>{
 const api=load().DG_DASHBOARD_CHART,events=[],charts={},created=[];let Chart;
 class LoadedChart{constructor(element,options){created.push({element,options});}}
 await api.render('late','bar',['P1'],[1],{ensure:async()=>{events.push('ensure');Chart=LoadedChart;},getChart:()=>{events.push('resolve');return Chart;},charts,element:id=>({id})});
 assert.deepEqual(events,['ensure','resolve']);assert.equal(created[0].element.id,'late');
});

test('world dashboard retains stats, table, marker, comparison and error flow',async()=>{
 const api=load().DG_LOAD_WORLD_DASHBOARD,events=[];
 await api.execute({hideError:()=>events.push('hide'),loadStats:async()=>({global:{data:{records:3}},countries:{data:[1]},cities:{data:[2]}}),updateStats:data=>events.push(['stats',data.records]),renderCountries:rows=>events.push(['countries',rows.length]),renderCities:rows=>events.push(['cities',rows.length]),loadMarkers:callback=>{events.push('markers');callback(1,[{id:1}],null);},markLiveDirty:()=>events.push('dirty'),clusterDegraded:()=>true,warn:message=>events.push(['warn',message]),renderAnalysis:(rows,id)=>events.push(['analysis',rows.length,id]),loadParkCompare:()=>events.push('compare'),showError:message=>events.push(['error',message])});
 assert.deepEqual(events.map(value=>Array.isArray(value)?value[0]:value),['hide','stats','countries','cities','markers','dirty','warn','analysis','compare']);
 const failed=[];await api.execute({hideError(){},loadStats:async()=>{throw Error('offline');},showError:message=>failed.push(message)});assert.deepEqual(failed,['offline']);
});

test('dashboard service delegates all five workflows and retains compatibility implementations',()=>{
 const source=readFileSync(new URL('../src/services/dash.js',import.meta.url),'utf8');
 for(const api of ['DG_LOAD_OWN_RECORDS_VIEW','DG_DELETE_OWN_RECORD','DG_LOAD_OWNER_DASHBOARD','DG_DASHBOARD_CHART','DG_LOAD_WORLD_DASHBOARD'])assert.ok(source.includes('window.'+api));
 for(const entry of ['async function loadRecords__scroll','async function delRec','async function loadDash','async function drawChart','async function loadWorld'])assert.ok(source.includes(entry));
});
