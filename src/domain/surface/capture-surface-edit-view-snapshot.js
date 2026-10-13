"use strict";

/* Capture reusable prepared edit geometry before showing the immutable raster. */
window.DG_CAPTURE_SURFACE_EDIT_VIEW_SNAPSHOT={
  capture({record,epoch,geometry,parkGeometry,partitionVersion,visualMemo}){return{record,epoch,geometry,parkGeometry,partitionVersion,visualMemo};}
};
