"use strict";

/* Draw dissolved NDVI features as a non-interactive map overlay. */
window.DG_RENDER_SURFACE_VEGETATION_FEATURES={
  render({features,opacity,renderer,colors,layer,createLayer,addLayer,polygon}){
    const target=layer||createLayer();target.clearLayers();
    for(const feature of features||[]){
      const type=feature.properties.class,rings=feature.geometry.coordinates.map(poly=>poly.map(ring=>ring.map(point=>[point[1],point[0]])));
      addLayer(polygon(rings,{renderer,stroke:false,weight:0,interactive:false,fillColor:colors[type]||colors.moderate,fillOpacity:opacity/100}),target);
    }
    return target;
  }
};
