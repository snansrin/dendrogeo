import snapshot from './country-meta.json' with {type:'json'};
import {lookupCountry,parseAddress} from './country-lookup.js';
let cached:Promise<Uint8Array|null>|null=null,retryAfter=0;
async function database(){
 if(cached)return cached;if(Date.now()<retryAfter)return null;
 cached=(async()=>{try{
  // Only public country ranges are downloaded. No visitor address or headers are forwarded.
  const response=await fetch('https://dendrogeo.org/supabase/functions/site-metrics/country-data.json?sha='+snapshot.sha256,{signal:AbortSignal.timeout(6000)});if(!response.ok)throw Error('Country snapshot unavailable');
  const value=await response.json();if(value.sha256!==snapshot.sha256||value.release!==snapshot.release)throw Error('Country snapshot mismatch');
  const packed=Uint8Array.from(atob(value.data),c=>c.charCodeAt(0));const binary=new Uint8Array(await new Response(new Blob([packed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',binary)),byte=>byte.toString(16).padStart(2,'0')).join('');if(digest!==snapshot.sha256)throw Error('Country snapshot integrity failure');
  return binary;
 }catch{console.warn('[site-metrics] country_snapshot_unavailable');cached=null;retryAfter=Date.now()+30000;return null;}})();return cached;
}
export async function resolveCountry(request:Request){
 const supplied=(request.headers.get('cf-ipcountry')||'').toUpperCase();if(/^[A-Z]{2}$/.test(supplied)&&!['XX','T1','ZZ'].includes(supplied))return supplied;
 const address=[request.headers.get('x-forwarded-for')?.split(',')[0],request.headers.get('x-real-ip'),request.headers.get('cf-connecting-ip')].find(value=>parseAddress(value));if(!address)return'ZZ';
 const binary=await database();return binary?lookupCountry(binary,address):'ZZ';
}
