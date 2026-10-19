/* Binary-search public country ranges. The supplied address is never retained. */
export function parseAddress(address){
 if(typeof address!=='string'||address.length>64)return null;let ip=address.trim().toLowerCase();
 if(ip.startsWith('::ffff:')&&ip.includes('.'))ip=ip.slice(7);
 if(!ip.includes(':')){const parts=ip.split('.');if(parts.length!==4||parts.some(x=>!/^\d{1,3}$/.test(x)||Number(x)>255))return null;return Uint8Array.from(parts.map(Number));}
 if(ip.includes('.')||ip.includes('%'))return null;const halves=ip.split('::');if(halves.length>2)return null;
 const left=halves[0]?halves[0].split(':'):[],right=halves[1]?halves[1].split(':'):[],missing=8-left.length-right.length;
 if(missing<0||(halves.length===2&&missing===0))return null;const groups=halves.length===1?left:[...left,...Array(missing).fill('0'),...right];if(groups.length!==8||groups.some(x=>!/^[0-9a-f]{1,4}$/i.test(x)))return null;
 const out=new Uint8Array(16);groups.forEach((group,index)=>{const value=parseInt(group,16);out[index*2]=value>>8;out[index*2+1]=value&255;});return out;
}
export function lookupCountry(binary,address){
 const target=parseAddress(address);if(!target)return'ZZ';const view=new DataView(binary.buffer,binary.byteOffset,binary.byteLength);if(binary.length<12||String.fromCharCode(...binary.subarray(0,4))!=='DGC1')return'ZZ';
 const ipv4=view.getUint32(4),ipv6=view.getUint32(8);if(binary.length!==12+ipv4*10+ipv6*34)return'ZZ';const size=target.length,step=size*2+2,base=size===4?12:12+ipv4*10;let low=0,high=(size===4?ipv4:ipv6)-1;
 const compare=offset=>{for(let i=0;i<size;i++){const delta=binary[offset+i]-target[i];if(delta)return delta;}return 0;};
 while(low<=high){const mid=Math.floor((low+high)/2),offset=base+mid*step;if(compare(offset)>0)high=mid-1;else if(compare(offset+size)<0)low=mid+1;else return String.fromCharCode(binary[offset+size*2],binary[offset+size*2+1]);}return'ZZ';
}
