/* Best-effort per-worker write budget, not a global or per-person rate limit.
 * No addresses, session identifiers or visitor fingerprints are retained. */
export function createIngestionBudget({limit=600,windowMs=60000,clock=Date.now,onExceeded=()=>{}}={}){
 let start=clock(),used=0,notified=false;
 return Object.freeze({allow(){
  const now=clock();
  if(now<start||now-start>=windowMs){start=now;used=0;notified=false;}
  if(used>=limit){if(!notified){notified=true;onExceeded();}return false;}
  used++;return true;
 }});
}
