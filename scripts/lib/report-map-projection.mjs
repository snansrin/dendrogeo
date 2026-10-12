/* Keeps the report map's local equirectangular pixel projection in one module. */
export function createReportMapProjection({ outer, outers = null, padding, top, mapHeight }) {
  let minLa = 90, maxLa = -90, minLo = 180, maxLo = -180;
  for (const [la, lo] of (outers || [outer]).flat()) {
    minLa = Math.min(minLa, la);
    maxLa = Math.max(maxLa, la);
    minLo = Math.min(minLo, lo);
    maxLo = Math.max(maxLo, lo);
  }
  const dxM = Math.max(1, (maxLo - minLo) * 111320 * Math.cos(((minLa + maxLa) / 2) * Math.PI / 180));
  const dyM = Math.max(1, (maxLa - minLa) * 110540);
  const width = Math.max(420, Math.min(1000, Math.round((mapHeight - 2 * padding) * dxM / dyM) + 2 * padding));
  const scale = Math.max(0.02, Math.min((width - 2 * padding) / dxM, (mapHeight - 2 * padding) / dyM));
  const cx = (minLo + maxLo) / 2, cy = (minLa + maxLa) / 2;
  const x = (lon) => width / 2 + (lon - cx) * 111320 * Math.cos(cy * Math.PI / 180) * scale;
  const y = (lat) => top + (mapHeight - 2 * padding) / 2 - (lat - cy) * 110540 * scale;
  return { width, scale, x, y };
}
