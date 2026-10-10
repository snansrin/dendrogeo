"use strict";

/* Existing OSM water and impervious tag rules, exposed as pure decisions. */
window.DG_PARK_SURFACE_TAGS = Object.freeze({
  isWater(el) {
    const t = el.tags || {};
    return (
      t.natural === "water" ||
      !!t.water ||
      t.landuse === "reservoir" ||
      t.landuse === "basin" ||
      t.leisure === "swimming_pool" ||
      t.waterway === "riverbank"
    );
  },

  isImpervious(el) {
    const t = el.tags || {};
    const surface = String(t.surface || "").toLowerCase().trim();
    const hardSurfaces = new Set([
      "asphalt", "paved", "concrete", "paving_stones", "sett",
      "concrete:plates", "concrete:lanes", "cobblestone", "bricks", "metal", "wood"
    ]);
    const softSurfaces = new Set([
      "grass", "dirt", "earth", "ground", "gravel", "fine_gravel",
      "sand", "mud", "unpaved", "compacted", "woodchips", "pebblestone", "clay"
    ]);

    if (t.building || t["building:part"]) return true;
    if (t["area:highway"] || t.landuse === "highway") return true;
    if (hardSurfaces.has(surface)) return true;
    if (softSurfaces.has(surface)) return false;

    if (
      t.amenity === "parking" ||
      t.amenity === "bicycle_parking" ||
      t.amenity === "motorcycle_parking"
    ) return true;

    if (t.leisure === "pitch" || t.leisure === "track" || t.leisure === "playground") {
      return hardSurfaces.has(surface);
    }

    if (t.highway) {
      const hw = String(t.highway).toLowerCase();
      const softWays = new Set([
        "footway", "path", "cycleway", "steps", "pedestrian", "bridleway", "track"
      ]);
      if (softWays.has(hw)) return hardSurfaces.has(surface);
      if (softSurfaces.has(surface)) return false;
      return true;
    }

    return false;
  }
});
