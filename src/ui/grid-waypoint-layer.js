"use strict";

/* Replace the visible waypoint layer with markers for the inserted rows. */
function dgRenderGridWaypointLayer({ map, previousLayer, rows, leaflet }) {
  if (previousLayer && map) map.removeLayer(previousLayer);
  const layer = leaflet.layerGroup().addTo(map);
  rows.forEach(row => leaflet.circleMarker(
    [row.lat, row.lon],
    {
      radius: 5,
      color: "#fff",
      weight: 1.5,
      fillColor: "#e11d48",
      fillOpacity: 0.95,
      interactive: false
    }
  ).addTo(layer));
  return layer;
}

window.DG_GRID_WAYPOINT_LAYER = Object.freeze({ render: dgRenderGridWaypointLayer });
