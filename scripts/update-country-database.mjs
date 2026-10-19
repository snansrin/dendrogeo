/* Convert DB-IP's CC BY 4.0 country ranges into a compact server-only snapshot. */
import {writeFileSync} from 'node:fs';import {gunzipSync,gzipSync} from 'node:zlib';import {createHash} from 'node:crypto';
const release=process.argv[2];if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(release||''))throw Error('Usage: node scripts/update-country-database.mjs YYYY-MM');
const source='https://download.db-ip.com/free/dbip-country-lite-'+release+'.csv.gz',response=await fetch(source);if(!response.ok)throw Error('DB-IP download failed: '+response.status);
const sourceBytes=Buffer.from(await response.arrayBuffer()),rows=gunzipSync(sourceBytes).toString('utf8').trim().split('\n'),v4=[],v6=[];
function bytes(ip){
 if(!ip.includes(':')){const parts=ip.split('.').map(Number);if(parts.length!==4||parts.some(x=>!Number.isInteger(x)||x<0||x>255))throw Error('Invalid IPv4');return Buffer.from(parts);}
 const halves=ip.split('::'),left=halves[0]?halves[0].split(':'):[],right=halves[1]?halves[1].split(':'):[],missing=8-left.length-right.length;
 const groups=halves.length===1?left:[...left,...Array(missing).fill('0'),...right];if(groups.length!==8||groups.some(x=>!/^[0-9a-f]{1,4}$/i.test(x)))throw Error('Invalid IPv6');return Buffer.from(groups.map(x=>x.padStart(4,'0')).join(''),'hex');
}
for(const row of rows){const[first,last,country]=row.trim().replaceAll('"','').split(',');if(!/^[A-Z]{2}$/.test(country))throw Error('Invalid country');const start=bytes(first),end=bytes(last);if(start.length!==end.length||Buffer.compare(start,end)>0)throw Error('Invalid range');const list=start.length===4?v4:v6,previous=list.at(-1),size=start.length;
 const adjacent=previous?Buffer.from(previous.subarray(size,size*2)):null;if(adjacent)for(let i=size-1;i>=0;i--){adjacent[i]++;if(adjacent[i]!==0)break;}
 if(previous&&previous.subarray(size*2).toString()===country&&adjacent.equals(start))end.copy(previous,size);else list.push(Buffer.concat([start,end,Buffer.from(country)]));}
for(const list of [v4,v6]){const size=list===v4?4:16;for(let i=1;i<list.length;i++)if(Buffer.compare(list[i-1].subarray(size,size*2),list[i].subarray(0,size))>=0)throw Error('Country ranges overlap or are unsorted');}
const header=Buffer.alloc(12);header.write('DGC1');header.writeUInt32BE(v4.length,4);header.writeUInt32BE(v6.length,8);const binary=Buffer.concat([header,...v4,...v6]),snapshot={release,source,license:'CC BY 4.0',attribution:'IP Geolocation by DB-IP — https://db-ip.com',source_sha256:createHash('sha256').update(sourceBytes).digest('hex'),sha256:createHash('sha256').update(binary).digest('hex'),encoding:'gzip-base64',ipv4_records:v4.length,ipv6_records:v6.length,data:gzipSync(binary,{level:9}).toString('base64')};
writeFileSync('supabase/functions/site-metrics/country-data.json',JSON.stringify(snapshot)+'\n');const {data,...metadata}=snapshot;writeFileSync('supabase/functions/site-metrics/country-meta.json',JSON.stringify(metadata,null,2)+'\n');console.log(JSON.stringify({release,ipv4:v4.length,ipv6:v6.length,binaryBytes:binary.length,bundleBytes:snapshot.data.length,sha256:snapshot.sha256}));
