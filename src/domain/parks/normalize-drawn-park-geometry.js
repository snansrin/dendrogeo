"use strict";
/* Preserve legacy ring acceptance; do not invent a bounding box as a polygon. */
window.DG_NORMALIZE_DRAWN_PARK_GEOMETRY={normalize(park){const rings=park?.rings,outer=Array.isArray(rings)?rings:Array.isArray(rings?.outer)?rings.outer:null;if(!outer||!outer.some(r=>Array.isArray(r)&&r.length>=4))return null;const holes=Array.isArray(rings)?[]:Array.isArray(rings?.inner)?rings.inner.filter(r=>Array.isArray(r)&&r.length>=4):[];return{outer,holes};}};
