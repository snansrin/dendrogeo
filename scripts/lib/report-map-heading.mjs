/* Draw the park and report identity lines at the top of the report map. */
export function drawReportMapHeading({
  text, width, padding, parkName, sub, sub2, meta, ink, muted
}) {
  text(padding, 12, parkName, ink, 3);
  text(padding, 44, sub, muted, 2);
  if (sub2) text(padding, 66, sub2, muted, 2);

  /* Keep the report ID visible when the map image is shared on its own. */
  if (meta && meta.id) {
    const id = String(meta.id);
    text(Math.max(padding, width - padding - 12 * id.length), 12, id, muted, 2);
  }
}
