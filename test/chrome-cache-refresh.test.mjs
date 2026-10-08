import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const code=readFileSync(new URL('../chrome-cache-refresh.html',import.meta.url),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
function fixture(){
 const deleted=[],unregistered=[],calls=[],nodes=new Map(),markers=new Map([['dg_sw_runtime_reload:old','1'],['login','keep']]);let destination=null;
 const html='<script id="dgRuntimeBuild" type="application/json">"20261008r90abcd"</script>'+Array.from({length:53},(_,i)=>'<script src="src/test'+i+'.js?v=20261008r90hash"></script>').join('');
 const env={location:{origin:'https://dendrogeo.org',replace:x=>destination=x},document:{getElementById:id=>{if(!nodes.has(id))nodes.set(id,{});return nodes.get(id);},documentElement:{dataset:{autostart:'false'}}},navigator:{serviceWorker:{getRegistrations:async()=>['https://dendrogeo.org/sw.js','https://dendrogeo.org/other.js'].map(scriptURL=>({scope:'https://dendrogeo.org/',active:{scriptURL},unregister:async()=>{unregistered.push(scriptURL);return true;}}))}},caches:{keys:async()=>['precache-dendrogeo-sw-v2-r88','runtime-dendrogeo-sw-v2-r90','api-dendrogeo-sw-v2-r88','tiles-dendrogeo-sw-v2-r90','images-dendrogeo-sw-v2-r90','other-app'],delete:async key=>{deleted.push(key);return true;}},sessionStorage:{get length(){return markers.size;},key:i=>[...markers.keys()][i],removeItem:key=>markers.delete(key)},fetch:async(url,options)=>{calls.push({url:String(url),options});return String(url).includes('release-version.json')?Response.json({version:'20261008r90'}):new Response(String(url).includes('/?')?html:'fresh asset');}};
 const context=vm.createContext({window:env,document:env.document,URL,Date,AbortSignal,console});vm.runInContext(code,context);
 return{env,context,deleted,unregistered,calls,markers,destination:()=>destination};
}
test('cache recovery revalidates current assets, unregisters only DendroGeo, purges only app caches and redirects once',async()=>{
 const f=fixture(),result=await f.context.dgChromeCacheRefresh(f.env);
 assert.equal(result.assets,53);assert.equal(result.release,'20261008r90');assert.deepEqual(f.unregistered,['https://dendrogeo.org/sw.js']);assert.deepEqual(f.deleted,['precache-dendrogeo-sw-v2-r88','runtime-dendrogeo-sw-v2-r90','api-dendrogeo-sw-v2-r88']);assert.ok(f.calls.every(x=>x.options.cache==='reload'));assert.equal(f.markers.get('login'),'keep');assert.equal(f.markers.has('dg_sw_runtime_reload:old'),false);assert.match(f.destination(),/^\/\?dg_fresh=/);
});
test('offline or obsolete publication never deletes cache or redirects to an unverified old page',async()=>{
 for(const obsolete of [false,true]){const f=fixture();f.env.fetch=async()=>{if(!obsolete)throw Error('offline');return Response.json({version:'20261008r88'});};await assert.rejects(f.context.dgChromeCacheRefresh(f.env));assert.deepEqual(f.deleted,[]);assert.deepEqual(f.unregistered,[]);assert.equal(f.destination(),null);}
});
