/* Ölçek çubuğu ve kuzey oku: rapor haritasının sabit kartografik sunumu. */
export function selectReportMapScaleMeters(scale) {
  return [10, 20, 50, 100, 200, 500].find((meters) => meters * scale > 90) || 1000;
}

export function drawReportMapScaleAndNorth({ canvas, width, padding, top, mapHeight, scale, ink }) {
  const nice = selectReportMapScaleMeters(scale);
  const barW = nice * scale, segN = 4;
  const sx0 = width - padding - barW;
  const sy0 = top + mapHeight - 40;
  const sy1 = top + mapHeight - 32;
  for (let i = 0; i < segN; i++) {
    const a = sx0 + barW * i / segN;
    const b = sx0 + barW * (i + 1) / segN;
    canvas.rect(a, sy0, b - 1, sy1, i % 2 === 0 ? ink : [255, 255, 255]);
  }
  canvas.line(sx0, sy0, sx0 + barW, sy0, ink);
  canvas.line(sx0, sy1, sx0 + barW, sy1, ink);
  canvas.line(sx0, sy0, sx0, sy1, ink);
  canvas.line(sx0 + barW, sy0, sx0 + barW, sy1, ink);
  canvas.text(sx0, sy0 - 22, nice + ' m', ink, 2);
  canvas.line(width - padding - 14, top + 60, width - padding - 14, top + 26, ink);
  canvas.line(width - padding - 20, top + 36, width - padding - 14, top + 24, ink);
  canvas.line(width - padding - 8, top + 36, width - padding - 14, top + 24, ink);
  canvas.text(width - padding - 24, top + 66, 'N', ink, 2);
}
