"use strict";

/* Grid-only last resort: closed polygon Boolean operations on integer millimetres. */
window.DG_INTEGER_GRID_CLIP={
  clip(operation,geometries,{library}){
    const operations={union:library.ClipType.ctUnion,difference:library.ClipType.ctDifference,intersection:library.ClipType.ctIntersection};
    if(!Object.hasOwn(operations,operation))throw Error('Unsupported grid polygon operation: '+operation);
    const paths=geometry=>geometry.flatMap(polygon=>polygon.map((ring,index)=>{
      const path=ring.map(point=>({X:Math.round(point[0]*1000),Y:Math.round(point[1]*1000)}));
      if(path.some(point=>![point.X,point.Y].every(value=>Number.isSafeInteger(value)&&Math.abs(value)<4503599627370495)))throw Error('Grid coordinates exceed the safe integer range.');
      if(library.Clipper.Orientation(path)!==(index===0))path.reverse();
      return path;
    }));
    const execute=(subject,clips,type)=>{
      if(!subject.length)return[];
      const engine=new library.Clipper(),tree=new library.PolyTree();
      engine.AddPaths(subject,library.PolyType.ptSubject,true);
      if(clips.length)engine.AddPaths(clips,library.PolyType.ptClip,true);
      if(!engine.Execute(type,tree,library.PolyFillType.pftNonZero,library.PolyFillType.pftNonZero))throw Error('Integer grid polygon operation failed.');
      return library.JS.PolyTreeToExPolygons(tree).map(polygon=>[polygon.outer,...polygon.holes].map(path=>{
        const ring=path.map(point=>[point.X/1000,point.Y/1000]);
        if(ring.length)ring.push([...ring[0]]);
        return ring;
      }));
    };
    // Union neighbouring raster pieces in bounded groups before combining the
    // results. This removes internal shared edges without dropping any piece.
    const unite=values=>{
      if(!values.length)return[];
      let level=values;
      while(level.length>64){
        const next=[];
        for(let i=0;i<level.length;i+=64)next.push(execute(level.slice(i,i+64).flatMap(paths),[],operations.union));
        level=next;
      }
      return execute(level.flatMap(paths),[],operations.union);
    };
    if(operation==='union')return unite(geometries);
    if(!geometries.length)return[];
    if(operation==='difference')return execute(paths(geometries[0]),paths(unite(geometries.slice(1))),operations.difference);
    let result=geometries[0];
    for(const geometry of geometries.slice(1)){
      if(!result.length||!geometry.length)return[];
      result=execute(paths(result),paths(geometry),operations.intersection);
    }
    return result;
  }
};
