import {test} from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
function app(){const els=new Map(),ctx=vm.createContext({console,Date,setTimeout,clearTimeout,setInterval,clearInterval,navigator:{userAgent:'QA'},sessionStorage:{getItem(){return'qa'}},localStorage:{getItem(){return null}},window:{},PROFILE:{role:'owner'},document:{hidden:false},$:id=>els.get(id)||null,esc:String});vm.runInContext(readFileSync(new URL('../src/services/visit-stats.js',import.meta.url),'utf8'),ctx);return{ctx,els,run:s=>vm.runInContext(s,ctx)};}
test('presence deduplicates users and removes expired sessions',()=>{const a=app(),now=Date.now();a.ctx.state={u:[{id:'a',n:'Old',t:now-20000},{id:'a',n:'Latest',t:now-1000}],v:[{id:'b',t:now-121000},{id:'c',t:now-1000}]};a.run('dgPresenceList=()=>state');const rows=a.run('dgVisRows()');assert.equal(rows.length,2);assert.equal(rows[0].p.n,'Latest');});
test('visitor filters search, active screen and valid location together',()=>{const a=app();a.els.set('visSearch',{value:'sinan'});a.els.set('visViewFilter',{value:'nav'});a.els.set('visLocated',{checked:true});a.ctx.rows=[{p:{n:'Sinan',v:'nav',la:39,lo:32}},{p:{n:'Sinan',v:'map',la:39,lo:32}},{p:{n:'Sinan',v:'nav',la:null,lo:null}}];assert.equal(a.run('dgVisFilter(rows)').length,1);assert.equal(a.run('dgVisHasLocation({la:"bad",lo:32})'),false);});
test('non-owner refresh does not read data or create a live map',async()=>{const a=app();let reads=0;a.ctx.sb={from(){reads++;throw Error('unexpected')}};a.ctx.PROFILE.role='user';await a.run('dgVisRefresh()');assert.equal(reads,0);assert.equal(a.run('DG_VIS_MAP'),null);});
test('connected background sessions remain visible despite heartbeat throttling',()=>{const a=app();a.ctx.state={u:[{id:'background',t:Date.now()-300000,hidden:true}]};a.run('DG_PRES_OK=true;dgPresenceList=()=>state');assert.equal(a.run('dgVisRows().length'),1);a.run('DG_PRES_OK=false');assert.equal(a.run('dgVisRows().length'),0);});
test('an old channel error cannot drop a resumed connection; tracking failures are visible',async()=>{const a=app(),channels=[];a.ctx.USER={id:'qa'};a.ctx.sb={channel(){const channel={on(){return this},subscribe(callback){this.notify=callback;return this},track:async()=>"ok",presenceState:()=>({})};channels.push(channel);return channel;},removeChannel:async()=>{},auth:{getSession:async()=>({data:{}})}};a.run('dgPresenceStart()');channels[0].notify('SUBSCRIBED');a.run('dgPresenceStop();dgPresenceStart()');channels[1].notify('SUBSCRIBED');channels[0].notify('CHANNEL_ERROR');assert.equal(a.run('dgPresenceState()'),'on');channels[1].track=async()=>"timed out";a.run('dgPresencePing(null,true)');await new Promise(r=>setTimeout(r,0));assert.equal(a.run('dgPresenceState()'),'error');a.run('dgPresenceStop()');});

test('quick live filters reuse the same search/view/location controls',()=>{
 const a=app();
 a.els.set('visSearch',{value:'sinan'});
 a.els.set('visViewFilter',{value:''});
 a.els.set('visLocated',{checked:false});
 a.ctx.renderVisitorsLive=()=>{};
 a.run("dgVisQuick('nav',true)");
 assert.equal(a.els.get('visSearch').value,'');
 assert.equal(a.els.get('visViewFilter').value,'nav');
 assert.equal(a.els.get('visLocated').checked,true);
});
