const FORBIDDEN={
  domain:new Set(['application','adapters','ui']),
  application:new Set(['adapters','ui'])
};

export const KNOWN_LEGACY_REFERENCES=new Map([
  ['src/application/map/render-waypoint-gps-overlay.js:DG_CREATE_WAYPOINT_GPS_LOCATION_MARKER','Waypoint GPS overlay UI callback is injected in the next map-boundary batch.'],
  ['src/application/map/render-waypoint-gps-overlay.js:DG_RENDER_WAYPOINT_GPS_GUIDANCE_READOUT','Waypoint GPS overlay UI callback is injected in the next map-boundary batch.'],
  ['src/application/map/render-waypoint-gps-overlay.js:DG_ADD_WAYPOINT_GUIDANCE_LINE','Waypoint GPS overlay UI callback is injected in the next map-boundary batch.'],
]);

export function isForbiddenLayerDependency(fromLayer,toLayer){
  return !!FORBIDDEN[fromLayer]?.has(toLayer);
}
