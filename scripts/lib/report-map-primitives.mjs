export function fillRing(cv, pts, col) {
  let y0 = 1e9, y1 = -1e9;
  for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  y0 = Math.max(0, Math.floor(y0)); y1 = Math.min(cv.h - 1, Math.ceil(y1));
  for (let y = y0; y <= y1; y++) {
    const xs = [];
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const ya = pts[j][1], yb = pts[i][1];
      if ((ya > y + 0.5) !== (yb > y + 0.5)) xs.push(pts[j][0] + (y + 0.5 - ya) / (yb - ya) * (pts[i][0] - pts[j][0]));
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) cv.rect(xs[i], y, xs[i + 1], y, col);
  }
}
export function strokeRing(cv, pts, col, thick = 1) {
  const OFF = thick <= 1 ? [[0, 0]] : [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]];
  for (const [ox, oy] of OFF)
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++)
      cv.line(pts[j][0] + ox, pts[j][1] + oy, pts[i][0] + ox, pts[i][1] + oy, col);
}
export function disc(cv, x, y, r, col) {
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++)
    if (dx * dx + dy * dy <= r * r) cv.set(x + dx, y + dy, col);
}
