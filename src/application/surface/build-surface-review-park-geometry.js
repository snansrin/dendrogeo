"use strict";

/* Construct one park geometry from outer rings and subtract its holes. */
window.DG_BUILD_SURFACE_REVIEW_PARK_GEOMETRY={
  build(outer,holes,epsg,{project,clip}){
    const rings=(outer||[]).filter(ring=>ring.length>=3).map(ring=>project(ring.map(point=>[point[1],point[0]]),epsg));
    if(!rings.length)throw Error("Park sınırı bulunamadı.");
    let geometry=clip("union",...rings.map(ring=>[ring]));
    const interior=(holes||[]).filter(ring=>ring.length>=3).map(ring=>[project(ring.map(point=>[point[1],point[0]]),epsg)]);
    if(interior.length)geometry=clip("difference",geometry,...interior);
    return geometry;
  }
};
