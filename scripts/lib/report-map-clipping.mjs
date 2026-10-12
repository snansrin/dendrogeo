/* Repaints scanline pixels outside polygon rings with the map context color. */
export function restoreOutsideRings(cv, allRings, yMap1, outsideColor) {
  for (let y = 0; y <= yMap1; y++) {
    const xs = [];
    for (const rg of allRings) for (let i = 0, j = rg.length - 1; i < rg.length; j = i++) {
      const ya = rg[j][1], yb = rg[i][1];
      if ((ya > y + 0.5) !== (yb > y + 0.5)) xs.push(rg[j][0] + (y + 0.5 - ya) / (yb - ya) * (rg[i][0] - rg[j][0]));
    }
    xs.sort((a, b) => a - b);
    let x = 0;
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const a = Math.max(0, Math.ceil(xs[i] ?? 0)), b = Math.min(cv.w - 1, Math.floor(xs[i + 1] ?? cv.w));
      if (x < a) cv.rect(x, y, a - 1, y, outsideColor);
      x = Math.max(x, b + 1);
    }
    if (x < cv.w) cv.rect(x, y, cv.w - 1, y, outsideColor);
  }
}
