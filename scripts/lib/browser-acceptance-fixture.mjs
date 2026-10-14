import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {resolve,extname} from 'node:path';
export async function serveFixture(port=0){
 const root=resolve('.');
 const server=createServer((request,response)=>{
  const path=resolve(root,'.'+new URL(request.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));
  if(!path.startsWith(root+'/')&&!path.startsWith(root+'\\')){response.writeHead(403).end();return;}
  try{response.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'})[extname(path)]||'application/octet-stream');response.end(readFileSync(path));}catch{response.writeHead(404).end();}
 });
 await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));
 return{url:'http://127.0.0.1:'+server.address().port,close:()=>new Promise(resolve=>server.close(resolve))};
}
export async function isolateAccount(page,authenticated=true){
 await page.addInitScript(value=>{window.__dgAnonymous=!value;},authenticated);
 await page.route('**/vendor/supabase-js-2.116.0.js',route=>route.fulfill({contentType:'text/javascript',body:`window.supabase={createClient(){
 const session=window.__dgAnonymous?null:{user:{id:'acceptance-fixture',email:'fixture@example.test'},access_token:'fixture'};
 const query=table=>{let chain;chain=new Proxy({}, {get(_target,key){if(key==='then')return resolve=>resolve({data:table==='profiles'?{full_name:'Test',role:'user'}:[],error:null,count:0});return()=>chain;}});return chain;};
 const channel={on(){return this;},subscribe(){return this;},track:async()=>{},unsubscribe:async()=>{},presenceState:()=>({})};
 return{auth:{getSession:async()=>({data:{session}}),onAuthStateChange(callback){setTimeout(()=>callback('INITIAL_SESSION',session),0);return{data:{subscription:{unsubscribe(){}}}};}},from:query,rpc:()=>query('rpc'),channel:()=>channel,removeChannel:async()=>{},realtime:{setAuth:async()=>{}}};
 }};`}));
 await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,route=>route.abort());
}
