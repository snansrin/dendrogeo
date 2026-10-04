/* Millimetre integer clipping is used only for cartographic display.
 * Scientific classification, accepted features and area calculations use
 * their existing geometry engine and are never changed by these operations. */
(function(root){
 const scale=1000;
 function paths(geom){const C=root.ClipperLib||root.window?.ClipperLib,out=[];for(const poly of geom||[])for(let i=0;i<poly.length;i++){
  const p=[];for(const q of poly[i]){const v={X:Math.round(q[0]*scale),Y:Math.round(q[1]*scale)};if(!p.length||v.X!==p.at(-1).X||v.Y!==p.at(-1).Y)p.push(v);}
  if(p.length>1&&p[0].X===p.at(-1).X&&p[0].Y===p.at(-1).Y)p.pop();if(p.length<3||C.Clipper.Area(p)===0)continue;
  if(C.Clipper.Orientation(p)!==(i===0))p.reverse();out.push(p);
 }return out;}
 function closed(contour){const r=contour.map(p=>[p.X/scale,p.Y/scale]);if(r.length)r.push(r[0].slice());return r;}
 function run(op,geoms){const C=root.ClipperLib||root.window?.ClipperLib;if(!C)throw Error('Görsel sınır modülü yüklenmedi.');if(!geoms.length)return[];
  const sets=geoms.map(paths);if(op==='union'?sets.every(p=>!p.length):!sets[0].length||(op==='intersection'&&sets.slice(1).some(p=>!p.length)))return[];
  const engine=new C.Clipper(),tree=new C.PolyTree();
  if(op==='union'){for(const g of geoms)engine.AddPaths(paths(g),C.PolyType.ptSubject,true);}else{engine.AddPaths(paths(geoms[0]),C.PolyType.ptSubject,true);for(const g of geoms.slice(1))engine.AddPaths(paths(g),C.PolyType.ptClip,true);}
  if(!engine.Execute(C.ClipType[{union:'ctUnion',difference:'ctDifference',intersection:'ctIntersection'}[op]],tree,C.PolyFillType.pftNonZero,C.PolyFillType.pftNonZero))throw Error('Görsel sınır birleştirmesi başarısız.');
  const out=[];function visit(n){if(!n.IsHole()&&n.Contour().length){const poly=[closed(n.Contour()),...n.Childs().filter(c=>c.IsHole()).map(c=>closed(c.Contour()))];out.push(poly);}for(const c of n.Childs())visit(c);}for(const n of tree.Childs())visit(n);return out;
 }
 root.DG_DISPLAY_CLIP={union:(...g)=>run('union',g),difference:(...g)=>g.length<2?run('union',g):run('difference',g),intersection:(...g)=>g.slice(1).reduce((a,b)=>run('intersection',[a,b]),g[0]||[])};
})(globalThis);
