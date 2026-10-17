"use strict";

/* Prepare park/green domains and all user-selected exclusion geometry. */
window.DG_PREPARE_SURFACE_GRID_DOMAIN={
  prepare(data,{size,clearance,epsg},{buildPark,bounds,clean,project,lineMask,clip}){
    const globalPark=buildPark(data.outer,data.holes||[],epsg),origin=bounds(globalPark).slice(0,2).map(value=>Math.floor(value));
    const local=geometry=>clean(geometry.map(polygon=>polygon.map(ring=>ring.map(point=>[point[0]-origin[0],point[1]-origin[1]]))));
    const global=geometry=>geometry.map(polygon=>polygon.map(ring=>ring.map(point=>[point[0]+origin[0],point[1]+origin[1]])));
    const park=local(globalPark),greens=(data.parts||[]).filter(part=>part.type==='green'&&part.geom?.length).map(part=>local(part.geom));
    if(data.greenOnly&&!greens.length)throw Error('Yeşil alan bulunamadı. Yüzey analizini kontrol edin.');
    let domain=data.greenOnly?clip('union',...greens):park;
    const obstacles=(data.blockRings||[]).filter(ring=>ring.length>=3).map(ring=>local([[project(ring.map(point=>[point[1],point[0]]),epsg)]]));
    for(const line of data.blockLines||[])if(line.pts?.length>=2)obstacles.push(local(lineMask(line,epsg)));
    if(obstacles.length)domain=clip('difference',domain,...obstacles);
    domain=clip('intersection',domain,park);
    const sourceObstacles=data.greenOnly?[...obstacles,...(data.parts||[]).filter(part=>part.type!=='green'&&part.geom?.length).map(part=>local(part.geom))]:obstacles;
    const constraints={park,obstacles:sourceObstacles.filter(geometry=>geometry.length).map(geometry=>({geometry,bounds:bounds(geometry)}))};
    return{globalPark,origin,local,global,park,domain,constraints,size,clearance,epsg};
  }
};
