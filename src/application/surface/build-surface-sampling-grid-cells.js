"use strict";

/* Create clipped, rounded sampling cells with proven interior coordinates. */
window.DG_BUILD_SURFACE_SAMPLING_GRID_CELLS={
  async build({safe,clearanceGeometry,constraints,park,origin,size,clearance,epsg,global},{bounds,overlap,clip,area,pointDistance,interiorPoint,unprojectGeometry,unprojectPoint,project,schedule}){
    const boundsPark=bounds(park),x0=Math.floor((boundsPark[0]+origin[0])/size)*size-origin[0],y0=Math.floor((boundsPark[1]+origin[1])/size)*size-origin[1],nx=Math.ceil((boundsPark[2]-x0)/size),ny=Math.ceil((boundsPark[3]-y0)/size);
    if(nx*ny>30000)throw Error('Park zarfı çok geniş. Daha büyük grid boyutu seçin.');
    const islands=safe.map(polygon=>({polygon,bounds:bounds([polygon])})),cells=[];
    for(let row=0;row<ny;row++)for(let col=0;col<nx;col++){
      const x=x0+col*size,y=y0+row*size,box=[x,y,x+size,y+size],near=islands.filter(island=>overlap(box,island.bounds));if(!near.length)continue;
      const quad=[[x,y],[x+size,y],[x+size,y+size],[x,y+size],[x,y]],geometry=clip('intersection',near.map(island=>island.polygon),[quad]),components=geometry.filter(polygon=>area([polygon])>=1);
      for(let component=0;component<components.length;component++){
        const piece=[components[component]];let point=[x+size/2,y+size/2];
        if(pointDistance(point,piece)<=0)point=interiorPoint(components[component]);if(!point)continue;
        const ll=unprojectPoint(point[0]+origin[0],point[1]+origin[1],epsg),lat=+ll.lat.toFixed(6),lon=+ll.lon.toFixed(6),rounded=project([[lon,lat]],epsg)[0].map((value,index)=>value-origin[index]);
        const distance=pointDistance(rounded,clearanceGeometry);if(distance<clearance||pointDistance(rounded,piece)<0)continue;
        // Verify against the original constraints too: numerical Boolean recovery
        // must never turn a nearby source obstacle into a valid sampling point.
        if(constraints&&(pointDistance(rounded,constraints.park)<clearance||constraints.obstacles.some(({geometry,bounds:b})=>rounded[0]>=b[0]-clearance&&rounded[0]<=b[2]+clearance&&rounded[1]>=b[1]-clearance&&rounded[1]<=b[3]+clearance&&pointDistance(rounded,geometry)>-clearance)))continue;
        const wgs=unprojectGeometry(global(piece),epsg),corners=quad.map(value=>unprojectPoint(value[0]+origin[0],value[1]+origin[1],epsg)),baseId=row+'_'+col;
        cells.push({id:baseId+(components.length>1?'_'+component:''),baseId,row,col,lat,lon,n:0,s0:Math.min(...corners.map(point=>point.lat)),s1:Math.max(...corners.map(point=>point.lat)),w0:Math.min(...corners.map(point=>point.lon)),w1:Math.max(...corners.map(point=>point.lon)),geometry:{type:'MultiPolygon',coordinates:wgs},areaM2:area(piece),clearanceM:distance});
      }
      if(cells.length>10000)throw Error('Grid çok yoğun. Daha büyük grid boyutu seçin.');
      if(cells.length%64===0)await schedule();
    }
    return{cells,x0:x0+origin[0],y0:y0+origin[1]};
  }
};
