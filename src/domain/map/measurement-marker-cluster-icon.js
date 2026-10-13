"use strict";

window.DG_MEASUREMENT_MARKER_CLUSTER_ICON={
  create(count,leaflet){const size=count<10?"small":count<50?"medium":"large";return leaflet.divIcon({html:`<div>${count}</div>`,className:`marker-cluster marker-cluster-${size}`,iconSize:[40,40]});}
};
