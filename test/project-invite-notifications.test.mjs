import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const escape=value=>String(value??'').replace(/[&<>"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[char]));
const files=[
 'src/domain/park-invites/access-policy.js',
 'src/adapters/park-invites/store.js',
 'src/application/park-invites/park-invite-state.js',
 'src/application/park-invites/load-owned-parks.js',
 'src/application/park-invites/load-recipient-invites.js',
 'src/application/park-invites/manage-invites.js',
 'src/ui/park-invite-inbox.js',
 'src/ui/park-collaboration-panel.js',
 'src/ui/owner-park-options.js',
 'src/ui/load-owner-collaborations.js',
 'src/ui/refresh-collaborations.js',
 'src/services/park-invites.js'
];

function setup(invites=[]){
 const elements=new Map(),requests=[],rpc=[];
 const getElement=id=>{
  if(!elements.has(id))elements.set(id,{id,textContent:'',innerHTML:'',value:'',style:{},attributes:{},
   hasAttribute(){return false;},setAttribute(name,value){this.attributes[name]=value;}});
  return elements.get(id);
 };
 const state={invites,error:null,deferred:[]};
 const sb={
  from(table){
   return {select(columns){
    let status=null;
    const query={
     eq(column,value){if(column==='status')status=value;return query;},
     then(resolve,reject){
      requests.push({table,columns,status});
      const rows=table==='park_invites'?state.invites.filter(row=>!status||row.status===status):[];
      const response=state.deferred.length&&columns==='email'?state.deferred.shift().promise:Promise.resolve({data:rows,error:state.error});
      return response.then(resolve,reject);
     }
    };
    return query;
   }};
  },
  rpc:async(name,args)=>{
   rpc.push({name,args});
   if(name==='dg_invite_respond'){
    const row=state.invites.find(invite=>invite.id===args.p_invite);
    if(row)row.status=args.p_accept?'Kabul':'Red';
   }
   return {data:null,error:null};
  }
 };
 const context=vm.createContext({console,Date,Promise,USER:{id:'nagihan',email:'nagihan@example.test'},PROFILE:{email:'nagihan@example.test'},sb,$:getElement,esc:escape,toast(){},dgCf:value=>value,loadProjects(){}});
 context.window=context;
 for(const file of files)vm.runInContext(read(file),context,{filename:file});
 return {context,getElement,requests,rpc,state,call:code=>vm.runInContext(code,context)};
}

const invite=(id,email='nagihan@example.test')=>({id,email,park_id:25,status:'Beklemede',created_at:'2026-10-31T12:00:00Z',parks:{name:'Dikmen 2. Etap',city:'Ankara'},note:'Saha'});

test('Projeler kırmızı rozeti yalnız oturum sahibinin bekleyen davetlerini gösterir; hafif sorgu kullanır',async()=>{
 const {call,getElement,requests}=setup([invite('i1','NAGIHAN@EXAMPLE.TEST'),invite('i2','baskasi@example.test'),{...invite('i3'),status:'Kabul'}]);
 await call('dgInvitesRefreshBadge()');
 const badge=getElement('projectInviteBadge');
 assert.equal(badge.textContent,'1');
 assert.equal(badge.style.display,'inline-block');
 assert.equal(badge.attributes['aria-label'],'1 bekleyen çalışma daveti');
 assert.equal(getElement('projInviteCount').textContent,'1');
 assert.deepEqual(requests.map(({table,columns,status})=>({table,columns,status})),[{table:'park_invites',columns:'email',status:'Beklemede'}]);
});

test('davet kartı kabul/red düğmelerinin yanında yanıt bekliyor gösterir ve cevapla rozeti kaldırır',async()=>{
 const {call,getElement,rpc}=setup([invite('i1')]);
 await call('dgInvitesLoadMine()');
 const html=getElement('dgInvBox').innerHTML;
 assert.match(html,/Dikmen 2\. Etap/);
 assert.match(html,/1 YANIT BEKLİYOR/);
 assert.match(html,/Yanıt bekliyor/);
 assert.match(html,/data-invite-id="i1" data-accept="true">✓ Kabul et/);
 assert.match(html,/data-invite-id="i1" data-accept="false">Reddet/);
 assert.equal(getElement('projectInviteBadge').textContent,'1');
 await call('dgInviteRespond("i1",true)');
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(rpc[0].name,'dg_invite_respond');
 assert.equal(rpc[0].args.p_accept,true);
 assert.equal(getElement('projectInviteBadge').style.display,'none');
 assert.equal(getElement('projInviteCount').textContent,'0');
 assert.equal(getElement('dgInvBox').style.display,'none');
});

test('reddedilen davet sayımdan kalkar, sayım 99+ üst sınırına uyar ve ağ hatası eski sayıyı silmez',async()=>{
 const {call,getElement,state}=setup([invite('i1')]);
 await call('dgInvitesLoadMine()');
 await call('dgInviteRespond("i1",false)');
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(getElement('projectInviteBadge').style.display,'none');
 call('window.DG_PARK_INVITE_INBOX_UI.setInviteBadge($,104)');
 assert.equal(getElement('projectInviteBadge').textContent,'99+');
 state.error=new Error('network offline');
 await call('dgInvitesRefreshBadge()');
 assert.equal(getElement('projectInviteBadge').textContent,'99+');
 assert.equal(getElement('projectInviteBadge').style.display,'inline-block');
});

test('geç gelen eski oturum yanıtı yeni kullanıcının rozetini değiştiremez',async()=>{
 const {call,getElement,state}=setup([]);
 let resolvePending;
 const pending=new Promise(resolve=>{resolvePending=resolve;});
 state.deferred.push({promise:pending});
 const old=call('dgInvitesRefreshBadge()');
 call('USER={id:"baska",email:"baska@example.test"};PROFILE={email:"baska@example.test"}');
 state.invites=[invite('new','baska@example.test')];
 await call('dgInvitesRefreshBadge()');
 assert.equal(getElement('projectInviteBadge').textContent,'1');
 resolvePending({data:[invite('old','nagihan@example.test'),invite('old2','nagihan@example.test')],error:null});
 await old;
 assert.equal(getElement('projectInviteBadge').textContent,'1');
});

test('misafir oturumunda rozet ve davet kartı temizlenir; eski davet gösterilmez',async()=>{
 const {call,getElement}=setup([invite('i1')]);
 await call('dgInvitesLoadMine()');
 call('USER=null');
 await call('dgInvitesRefreshBadge()');
 assert.equal(getElement('projectInviteBadge').style.display,'none');
 assert.equal(getElement('dgInvBox').style.display,'none');
});

test('bildirim kablolaması temayı, yetki/RPC ve çekirdek haritaları değiştirmez',()=>{
 const shell=read('partials/shell.html'),service=read('src/ui/shell.js'),store=read('src/adapters/park-invites/store.js');
 assert.match(shell,/data-dg-view="projects">📁 Projeler<span id="projectInviteBadge" class="dg-menu-badge" style="display:none"/);
 assert.match(service,/dgRefreshInviteNotice\(true\)/);
 assert.match(service,/visibilitychange/);
 assert.match(service,/setInterval\(\(\)=>dgRefreshInviteNotice\(\),120000\)/);
 assert.match(service,/navigator\.onLine===false/);
 assert.match(service,/typeof window\.addEventListener==="function"/);
 assert.match(store,/pendingBadge:\(\)=>getClient\(\)\.from\("park_invites"\)\.select\("email"\)\.eq\("status","Beklemede"\)/);
 assert.doesNotMatch(store,/pendingBadge:[^\n]*(?:insert|update|delete|rpc)\(/);
});
