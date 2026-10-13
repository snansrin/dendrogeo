"use strict";

/* Snapshot the current inputs while accepting OSM evidence only for this park. */
window.DG_BUILD_SURFACE_REPARTITION_INPUT={
  build({cells,outer,holes,epsg,objects,elements,elementsBoundary,parkBoundary,features,rawView,useObjects}){
    return{cells,outer,holes,epsg,objects,elements:elementsBoundary===parkBoundary?elements:[],features:rawView?[]:features,useObjects:!rawView&&useObjects};
  }
};
