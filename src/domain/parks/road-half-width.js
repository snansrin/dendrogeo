"use strict";

/* OSM highway fallback half-widths used only for grid collision buffers. */
window.DG_PARK_ROAD_WIDTH = Object.freeze({
  halfWidth(highway) {
    highway = String(highway || "").toLowerCase();

    if (/^motorway$/.test(highway)) return 6;
    if (/^trunk$/.test(highway)) return 5.5;
    if (/^primary$/.test(highway)) return 5;
    if (/^secondary$/.test(highway)) return 4.5;
    if (/^tertiary$/.test(highway)) return 4;

    if (/^residential$/.test(highway)) return 3;
    if (/^unclassified$/.test(highway)) return 3;
    if (/^living_street$/.test(highway)) return 3;

    if (/^service$/.test(highway)) return 2.5;

    /* These buffers keep narrow paths from crossing grid cells unnoticed. */
    if (/^footway$/.test(highway)) return 1.25;
    if (/^path$/.test(highway)) return 1.25;
    if (/^cycleway$/.test(highway)) return 1.5;
    if (/^pedestrian$/.test(highway)) return 2;
    if (/^steps$/.test(highway)) return 1.25;
    if (/^bridleway$/.test(highway)) return 1.25;
    if (/^track$/.test(highway)) return 1.5;

    return 3;
  }
});
