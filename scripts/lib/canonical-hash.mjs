import {createHash} from 'node:crypto';

/* Stable SHA-256 for immutable report snapshots and publication artifacts. */
export function canonicalHash(obj){
 /* Duck-typing keeps snapshots from other vm realms independent of instanceof. */
 const stable=(value)=>JSON.stringify(value,(key,item)=>item!==null&&typeof item==='object'&&!Array.isArray(item)
  ?Object.keys(item).sort().reduce((ordered,name)=>(ordered[name]=item[name],ordered),{})
  :item);
 return createHash('sha256').update(stable(obj)).digest('hex');
}
