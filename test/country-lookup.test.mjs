import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {gunzipSync} from 'node:zlib';import {createHash} from 'node:crypto';import {lookupCountry,parseAddress} from '../supabase/functions/site-metrics/country-lookup.js';
const source=JSON.parse(readFileSync(new URL('../supabase/functions/site-metrics/country-data.json',import.meta.url),'utf8')),binary=gunzipSync(Buffer.from(source.data,'base64'));
test('country snapshot is pinned, attributed, and searched at IPv4 and IPv6 range boundaries',()=>{
 const metadata=JSON.parse(readFileSync(new URL('../supabase/functions/site-metrics/country-meta.json',import.meta.url),'utf8'));assert.equal(createHash('sha256').update(binary).digest('hex'),metadata.sha256);assert.equal(metadata.license,'CC BY 4.0');assert.equal(binary.readUInt32BE(4),metadata.ipv4_records);assert.equal(binary.readUInt32BE(8),metadata.ipv6_records);
 for(const size of [4,16]){const count=size===4?metadata.ipv4_records:metadata.ipv6_records,base=size===4?12:12+metadata.ipv4_records*10,step=size*2+2;for(let i=0;i<count;i+=Math.ceil(count/40)){const offset=base+i*step,country=binary.subarray(offset+size*2,offset+size*2+2).toString();for(const start of [offset,offset+size]){const bytes=binary.subarray(start,start+size),address=size===4?[...bytes].join('.'):Array.from({length:8},(_,n)=>bytes.readUInt16BE(n*2).toString(16)).join(':');assert.equal(lookupCountry(binary,address),country);}}}
});
test('country lookup rejects malformed addresses and normalizes IPv4-mapped IPv6 without retaining input',()=>{
 for(const address of ['secret','8.8.8.999','1.2.3',':::',null,'fe80::1%en0','1:2:3:4:5:6:7:8:9'])assert.equal(parseAddress(address),null);
 assert.equal(lookupCountry(binary,'::ffff:8.8.8.8'),lookupCountry(binary,'8.8.8.8'));assert.equal(lookupCountry(binary,'8.8.8.8'),'US');assert.equal(lookupCountry(binary,'127.0.0.1'),'ZZ');assert.equal(lookupCountry(new Uint8Array(0),'8.8.8.8'),'ZZ');
});
