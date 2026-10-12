import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

function app({role='owner',data=[],error=null}={}){
 const calls=[],elements=new Map(),window={};
 for(const id of ['aUsersTotal','aUsersActive','aUsersAdmin','aUsersPassive','aUsersVisible'])elements.set(id,{});
 elements.set('aUsersT',{innerHTML:'old',querySelectorAll:()=>[]});
 const ctx=vm.createContext({window,PROFILE:{role},esc:value=>value==null?'':String(value).replaceAll('<','&lt;').replaceAll('>','&gt;'),$:id=>elements.get(id),toast:(...args)=>calls.push(['toast',...args]),dgScrollKeep:()=>42,dgScrollRestore:y=>calls.push(['restore',y]),sb:{from(table){calls.push(['from',table]);return{select(columns){calls.push(['select',columns]);return Promise.resolve({data,error});},update(body){calls.push(['update',JSON.parse(JSON.stringify(body))]);return this;},eq(column,value){calls.push(['eq',column,value]);return Promise.resolve({error});}};}}});
 for(const file of ['src/adapters/users/admin-store.js','src/services/user-admin.js'])vm.runInContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),ctx);
 return{ctx,calls,elements,run:code=>vm.runInContext(code,ctx)};
}

test('user management preserves read gates and owner-only mutation gates',async()=>{
 const user=app({role:'user'});await user.run('loadUsers();');assert.equal(user.calls.some(c=>c[0]==='from'),false);
 for(const role of ['user','admin']){const a=app({role});await a.run('updateRole("qa","admin");');await a.run('toggleU("qa",false);');assert.equal(a.calls.some(c=>c[0]==='from'),false);assert.equal(a.calls.filter(c=>c[0]==='toast').length,2);}
});

test('user management adapter keeps exact role/active payloads and error path avoids refresh',async()=>{
 const a=app({error:{message:'denied'}});await a.run('updateRole("qa","admin")');await a.run('toggleU("qa",false)');
 assert.deepEqual(a.calls.filter(c=>c[0]!=='toast'),[['from','profiles'],['update',{role:'admin'}],['eq','id','qa'],['from','profiles'],['update',{active:false}],['eq','id','qa']]);
 assert.equal(a.calls.filter(c=>c[0]==='toast').length,2);
});

test('user list preserves exact select, counters, escaped rows and scroll restoration',async()=>{
 const a=app({data:[{id:'owner',full_name:'Owner',role:'owner',active:true},{id:'qa',full_name:'<Ada>',email:'qa@example.test',role:'user',active:false}]});await a.run('loadUsers()');
 assert.deepEqual(a.calls,[['from','profiles'],['select','*'],['restore',42]]);
 assert.equal(a.elements.get('aUsersTotal').textContent,2);assert.equal(a.elements.get('aUsersActive').textContent,1);assert.equal(a.elements.get('aUsersAdmin').textContent,1);assert.equal(a.elements.get('aUsersPassive').textContent,1);
 assert.match(a.elements.get('aUsersT').innerHTML,/🛡 Korunuyor/);assert.match(a.elements.get('aUsersT').innerHTML,/&lt;Ada&gt;/);assert.match(a.elements.get('aUsersT').innerHTML,/updateRole\('qa'/);
});

test('admin user list is read-only and API failure preserves prior table and cache',async()=>{
 const admin=app({role:'admin',data:[{id:'qa',full_name:'Ada',role:'user',active:true}]});await admin.run('loadUsers()');assert.match(admin.elements.get('aUsersT').innerHTML,/Salt okunur/);assert.doesNotMatch(admin.elements.get('aUsersT').innerHTML,/updateRole\('/);
 const a=app({error:{message:'denied'}});a.run('USERS_CACHE=[{id:"old"}]');await a.run('loadUsers()');assert.equal(a.elements.get('aUsersT').innerHTML,'old');assert.equal(a.run('USERS_CACHE[0].id'),'old');assert.deepEqual(a.calls.at(-1),['restore',42]);
});
