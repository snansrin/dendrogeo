/* Cartographic generalisation only: exact accepted geometry and area_m2 are immutable.
 * Object/park boundaries are protected; only raster staircase vertices may move. */
(function(root){
 function distance(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);}
 function simplify(points,tol){if(points.length<3)return points;const keep=new Set([0,points.length-1]),stack=[[0,points.length-1]];while(stack.length){const[a,b]=stack.pop();let far=-1,d=tol;for(let i=a+1;i<b;i++){const n=distance(points[i],points[a],points[b]);if(n>d){d=n;far=i;}}if(far>=0){keep.add(far);stack.push([a,far],[far,b]);}}return points.filter((p,i)=>keep.has(i));}
 function area(r){let a=0;for(let i=0;i<r.length-1;i++)a+=r[i][0]*r[i+1][1]-r[i+1][0]*r[i][1];return a/2;}
 function ring(points,protectedEdges=[],tolerance=6){
  if(points.length<5)return points.map(p=>p.slice());const original=points.slice(0,-1),n=original.length;
  const protectedPoint=p=>protectedEdges.some(([a,b])=>p[0]>=Math.min(a[0],b[0])-.02&&p[0]<=Math.max(a[0],b[0])+.02&&p[1]>=Math.min(a[1],b[1])-.02&&p[1]<=Math.max(a[1],b[1])+.02&&distance(p,a,b)<.02);
  let anchors=original.map((p,i)=>protectedPoint(p)?i:-1).filter(i=>i>=0);
  // Stable extrema preserve ring extent and give closed rings deterministic anchors.
  for(const axis of [0,1])for(const sign of [-1,1]){let k=0;for(let i=1;i<n;i++)if(sign*original[i][axis]>sign*original[k][axis]||(original[i][axis]===original[k][axis]&&original[i][1-axis]<original[k][1-axis]))k=i;anchors.push(k);}
  anchors=[...new Set(anchors)].sort((a,b)=>a-b);const out=[];
  for(let j=0;j<anchors.length;j++){const start=anchors[j],end=anchors[(j+1)%anchors.length],path=[original[start]];let k=(start+1)%n;while(k!==end){path.push(original[k]);k=(k+1)%n;}path.push(original[end]);out.push(...simplify(path,tolerance).slice(0,-1));}
  const rounded=[];for(let i=0;i<out.length;i++){const p=out[i],prev=out[(i+out.length-1)%out.length],next=out[(i+1)%out.length];if(protectedPoint(p)){rounded.push(p);continue;}const len1=Math.hypot(p[0]-prev[0],p[1]-prev[1]),len2=Math.hypot(p[0]-next[0],p[1]-next[1]),cut=Math.min(2.5,len1*.2,len2*.2);if(cut<.05){rounded.push(p);continue;}const a=[p[0]+(prev[0]-p[0])*cut/len1,p[1]+(prev[1]-p[1])*cut/len1],b=[p[0]+(next[0]-p[0])*cut/len2,p[1]+(next[1]-p[1])*cut/len2];rounded.push(a);for(const t of [.25,.5,.75,1])rounded.push([(1-t)**2*a[0]+2*(1-t)*t*p[0]+t*t*b[0],(1-t)**2*a[1]+2*(1-t)*t*p[1]+t*t*b[1]]);}
  if(rounded.length<3)return points.map(p=>p.slice());rounded.push(rounded[0]);if(area(rounded)*area(points)<=0||Math.abs(area(rounded))<Math.abs(area(points))*.5)return points.map(p=>p.slice());return rounded;
 }
 function smoothOpen(path,tol){const simple=simplify(path,tol);if(simple.length<3)return simple;const out=[simple[0]];for(let i=1;i<simple.length-1;i++){const p=simple[i],a=simple[i-1],b=simple[i+1],l1=Math.hypot(p[0]-a[0],p[1]-a[1]),l2=Math.hypot(p[0]-b[0],p[1]-b[1]),c=Math.min(2.5,l1*.2,l2*.2);if(!c){out.push(p);continue;}const x=[p[0]+(a[0]-p[0])*c/l1,p[1]+(a[1]-p[1])*c/l1],y=[p[0]+(b[0]-p[0])*c/l2,p[1]+(b[1]-p[1])*c/l2];out.push(x);for(const t of [.25,.5,.75,1])out.push([(1-t)**2*x[0]+2*(1-t)*t*p[0]+t*t*y[0],(1-t)**2*x[1]+2*(1-t)*t*p[1]+t*t*y[1]]);}out.push(simple.at(-1));return out;}
 function topology(geoms,protectedEdges=[],tol=6){
  // Node collinear boundaries before building shared arcs. Polygon unions may
  // remove an intermediate vertex on one side of an otherwise shared edge.
  const bins=new Map(),size=20,seen=new Map();
  for(const geom of geoms)for(const poly of geom)for(const r of poly)for(const p of r){const k=p.map(v=>Math.round(v*1000)).join(',');if(seen.has(k))continue;seen.set(k,p);const b=Math.floor(p[0]/size)+','+Math.floor(p[1]/size);if(!bins.has(b))bins.set(b,[]);bins.get(b).push(p);}
  geoms=geoms.map(geom=>geom.map(poly=>poly.map(r=>{const out=[];for(let i=1;i<r.length;i++){const a=r[i-1],b=r[i],dx=b[0]-a[0],dy=b[1]-a[1],len=dx*dx+dy*dy,cuts=[];out.push(a);if(!len)continue;for(let x=Math.floor(Math.min(a[0],b[0])/size);x<=Math.floor(Math.max(a[0],b[0])/size);x++)for(let y=Math.floor(Math.min(a[1],b[1])/size);y<=Math.floor(Math.max(a[1],b[1])/size);y++)for(const p of bins.get(x+','+y)||[]){const t=((p[0]-a[0])*dx+(p[1]-a[1])*dy)/len;if(t>1e-7&&t<1-1e-7&&distance(p,a,b)<.001)cuts.push({p,t});}cuts.sort((a,b)=>a.t-b.t);out.push(...cuts.map(c=>c.p));}out.push(out[0]);return out;})));

  const key=p=>p.map(v=>Math.round(v*1000)).join(','),nodes=new Map(),edges=new Map(),paths=new Map();
  for(let gi=0;gi<geoms.length;gi++)for(const poly of geoms[gi])for(const r of poly)for(let i=1;i<r.length;i++){const a=key(r[i-1]),b=key(r[i]);if(a===b)continue;nodes.set(a,r[i-1]);nodes.set(b,r[i]);const id=[a,b].sort().join('|');if(!edges.has(id))edges.set(id,{a,b,labels:new Set()});edges.get(id).labels.add(gi);}
  const groups=new Map();for(const[id,e]of edges){const group=[...e.labels].sort((a,b)=>a-b).join(',');if(!groups.has(group))groups.set(group,new Map());groups.get(group).set(id,e);}
  const isProtected=new Map();for(const[k,p]of nodes)isProtected.set(k,protectedEdges.some(([a,b])=>p[0]>=Math.min(a[0],b[0])-.02&&p[0]<=Math.max(a[0],b[0])+.02&&p[1]>=Math.min(a[1],b[1])-.02&&p[1]<=Math.max(a[1],b[1])+.02&&distance(p,a,b)<.02));
  for(const group of groups.values()){
   const adj=new Map(),done=new Set();for(const[id,e]of group)for(const k of [e.a,e.b]){if(!adj.has(k))adj.set(k,[]);adj.get(k).push(id);}
   const anchor=k=>adj.get(k).length!==2||isProtected.get(k);
   const walk=(start,edgeId)=>{const chain=[],keys=[start];let k=start,id=edgeId;while(!done.has(id)){done.add(id);const e=group.get(id),next=e.a===k?e.b:e.a;chain.push({id,from:k,to:next});keys.push(next);k=next;if(k===start||anchor(k))break;id=adj.get(k).find(x=>!done.has(x));if(!id)break;}
    const original=keys.map(k=>nodes.get(k)),closed=keys.at(-1)===keys[0];
    const smoothed=closed?ring(original,protectedEdges,tol):smoothOpen(original,tol);
    // Every neighbour reuses this exact path in reverse: no independent class rounding.
    for(let i=0;i<chain.length;i++){const e=chain[i];paths.set(e.from+'>'+e.to,i===0?smoothed.slice(0,-1):[]);paths.set(e.to+'>'+e.from,i===chain.length-1?smoothed.slice().reverse().slice(0,-1):[]);}
   };
   for(const[k,list]of adj)if(anchor(k))for(const id of list)if(!done.has(id))walk(k,id);
   for(const[id,e]of group)if(!done.has(id))walk(e.a,id);
  }
  return geoms.map(geom=>geom.map(poly=>poly.map(r=>{const out=[];for(let i=1;i<r.length;i++){const path=paths.get(key(r[i-1])+'>'+key(r[i]));if(path)out.push(...path);else out.push(r[i-1]);}if(out.length<3)return r.map(p=>p.slice());out.push(out[0]);return out;})));
 }
 root.DG_SURFACE_DISPLAY={ring,simplify,distance,topology};
})(globalThis);
