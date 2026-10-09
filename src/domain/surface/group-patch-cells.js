"use strict";
/* Saf yüzey alanı: aynı sınıftaki 4-komşulu hücreleri bileşenlere ayırır.
 * Alan eşiği, geometri, çizim ve son analiz durumu burada tutulmaz. */
(function(root){
function dgSurfaceGroupPatchCells(cells){
  const key=c=>c.epsg+":"+c.row+":"+c.col;
  const grid=new Map();
  for(const c of cells)grid.set(key(c),c);
  const seen=new Set();
  const components=[];
  for(const c of cells){
    const k0=key(c);
    if(seen.has(k0))continue;
    seen.add(k0);
    const stack=[c];
    const component=[c];
    while(stack.length){
      const cur=stack.pop();
      const nb=[[1,0],[-1,0],[0,1],[0,-1]];
      for(const [dr,dc] of nb){
        const nk=cur.epsg+":"+(cur.row+dr)+":"+(cur.col+dc);
        const n=grid.get(nk);
        if(n&&!seen.has(nk)&&n.classKey===cur.classKey){
          seen.add(nk);
          stack.push(n);
          component.push(n);
        }
      }
    }
    components.push(component);
  }
  return components;
}
root.DG_SURFACE_PATCH_COMPONENTS=Object.freeze({groupCells:dgSurfaceGroupPatchCells});
})(typeof window!=="undefined"?window:globalThis);
