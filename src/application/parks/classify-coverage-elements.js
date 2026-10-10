"use strict";

/* Route detailed OSM coverage elements without owning geometry or UI state. */
window.DG_PARK_COVERAGE_ELEMENT_CLASSIFIER = Object.freeze({
  classify(elements, { isWater, isImpervious }) {
    const seenWater = new Set();
    const seenImpervious = new Set();

    return (elements || []).map(element => {
      const id = element.type + ":" + element.id;

      if (isWater(element)) {
        if (seenWater.has(id)) {
          return { element, water: true, skip: true, pedestrian: false, impervious: false };
        }
        seenWater.add(id);
        return { element, water: true, skip: false, pedestrian: false, impervious: false };
      }

      const pedestrian = !!(element.type === "way" && element.tags && element.tags.highway);
      if (!isImpervious(element)) {
        return { element, water: false, skip: false, pedestrian, impervious: false };
      }

      if (seenImpervious.has(id)) {
        return { element, water: false, skip: false, pedestrian, impervious: false };
      }
      seenImpervious.add(id);
      return { element, water: false, skip: false, pedestrian, impervious: true };
    });
  }
});
