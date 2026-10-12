/* Envanter noktalarını rapor haritası çerçevesinin içinde tutarak çizer. */
export function drawReportMapInventoryPoints({ canvas, points, project, frame, disc, tones }) {
  for (const point of points) {
    const [x, y] = project(point.lon, point.lat);
    if (x < frame.left || x > frame.right || y < frame.top || y > frame.bottom) continue;
    disc(canvas, x, y, 5, tones.halo);
    disc(canvas, x, y, 3, tones.ink);
  }
}
